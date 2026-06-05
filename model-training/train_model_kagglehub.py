"""
Plant Disease Classifier — Training with New Kaggle Dataset (kagglehub)
========================================================================
Dataset:       New Plant Diseases Dataset (Augmented) - vipoooool/new-plant-diseases-dataset
Architecture:  EfficientNetV2-S with transfer learning (ImageNet pretrained)
Input size:    224x224x3
Output:        38-class softmax (plant diseases from PlantVillage)
Expected acc:  ~95%+ with GPU training

Uses:
- kagglehub for automatic dataset download
- EfficientNetV2-S (proven high accuracy on leaf disease)
- Two-phase training: head-only → fine-tune backbone
- Float16 TF.js model (~8-15MB depending on quantization)

Usage:
  # Full training with dataset download (requires ~2GB free disk, T4 GPU ~25 min)
  python train_model_kagglehub.py --data_source kaggle

  # Smoke test (quick pipeline validation, no real data needed)
  python train_model_kagglehub.py --smoke_test
"""

import os
import sys
import json
import argparse
import numpy as np
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from pathlib import Path

# Suppress TF warnings
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
tf.get_logger().setLevel('ERROR')

# ─── CONFIG ─────────────────────────────────────────────────────────────
IMG_SIZE = 224
BATCH_SIZE = 64  # Larger batch on GPU (Colab T4)
NUM_CLASSES = 38
PHASE1_EPOCHS = 5  # Train head only
PHASE2_EPOCHS = 20  # Fine-tune backbone
LR_HEAD = 1e-3
LR_FINETUNE = 5e-5

# PlantVillage classes (must match dataset)
CLASS_NAMES = [
    "Apple___Apple_scab", "Apple___Black_rot", "Apple___Cedar_apple_rust", "Apple___healthy",
    "Blueberry___healthy", "Cherry_(including_sour)___Powdery_mildew", "Cherry_(including_sour)___healthy",
    "Corn_(maize)___Cercospora_leaf_spot", "Corn_(maize)___Common_rust_", "Corn_(maize)___Northern_Leaf_Blight",
    "Corn_(maize)___healthy",
    "Grape___Black_rot", "Grape___Esca_(Black_Measles)", "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)",
    "Grape___healthy",
    "Orange___Haunglongbing_(Citrus_greening)",
    "Peach___Bacterial_spot", "Peach___healthy",
    "Pepper,_bell___Bacterial_spot", "Pepper,_bell___healthy",
    "Potato___Early_blight", "Potato___Late_blight", "Potato___healthy",
    "Raspberry___healthy", "Soybean___healthy", "Squash___Powdery_mildew",
    "Strawberry___Leaf_scorch", "Strawberry___healthy",
    "Tomato___Bacterial_spot", "Tomato___Early_blight", "Tomato___Late_blight", "Tomato___Leaf_Mold",
    "Tomato___Septoria_leaf_spot", "Tomato___Spider_mites", "Tomato___Target_Spot",
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus", "Tomato___Tomato_mosaic_virus", "Tomato___healthy",
]


# ─── DATASET LOADING ────────────────────────────────────────────────────
def download_dataset_kagglehub():
    """Download New Plant Diseases Dataset using kagglehub."""
    print("📥 Downloading dataset with kagglehub...")
    try:
        import kagglehub
        path = kagglehub.dataset_download("vipoooool/new-plant-diseases-dataset")
        print(f"✓ Dataset downloaded to: {path}")
        
        # Find the actual train/valid directories
        # The structure is typically:
        # new-plant-diseases-dataset/
        #   └─ New Plant Diseases Dataset(Augmented)/
        #      └─ New Plant Diseases Dataset(Augmented)/
        #         ├─ train/
        #         └─ valid/
        
        for root, dirs, _ in os.walk(path):
            if "train" in dirs and "valid" in dirs:
                print(f"✓ Found train/valid dirs: {root}")
                return root
        
        raise FileNotFoundError(f"Could not find train/valid directories in {path}")
    
    except ImportError:
        print("❌ kagglehub not installed. Run: pip install kagglehub")
        sys.exit(1)


def make_dataset_from_directories(train_dir, valid_dir, img_size, batch_size):
    """Load train/validation datasets directly from directories."""
    print(f"📂 Loading train data from: {train_dir}")
    print(f"📂 Loading valid data from: {valid_dir}")
    
    train_ds = keras.utils.image_dataset_from_directory(
        train_dir,
        seed=42,
        image_size=(img_size, img_size),
        batch_size=batch_size,
        label_mode='categorical',
        shuffle=True,
    )
    
    valid_ds = keras.utils.image_dataset_from_directory(
        valid_dir,
        seed=42,
        image_size=(img_size, img_size),
        batch_size=batch_size,
        label_mode='categorical',
        shuffle=False,
    )
    
    class_names = train_ds.class_names
    print(f"✓ Found {len(class_names)} classes")
    print(f"  Train batches: {len(train_ds)}")
    print(f"  Valid batches: {len(valid_ds)}")
    
    return train_ds, valid_ds, class_names


def build_augmentation():
    """Heavy augmentation to mimic field conditions."""
    return keras.Sequential([
        layers.RandomFlip("horizontal_and_vertical"),
        layers.RandomRotation(0.2),
        layers.RandomZoom((-0.25, 0.25)),
        layers.RandomBrightness(factor=0.25),
        layers.RandomContrast(factor=0.25),
    ], name="augmentation")


def make_synthetic_dataset(num_classes, samples=12, img_size=224, batch_size=4):
    """Synthetic dataset for quick testing."""
    rng = np.random.default_rng(42)
    imgs, lbls = [], []
    
    for c in range(num_classes):
        for _ in range(samples):
            img = rng.random((img_size, img_size, 3)).astype(np.float32) * 0.4
            img[:, :, c % 3] += 0.4 + (c / num_classes) * 0.2
            imgs.append(np.clip(img * 255, 0, 255))
            lbl = np.zeros(num_classes, np.float32)
            lbl[c] = 1.0
            lbls.append(lbl)
    
    imgs, lbls = np.array(imgs), np.array(lbls)
    idx = rng.permutation(len(imgs))
    imgs, lbls = imgs[idx], lbls[idx]
    split = int(0.8 * len(imgs))
    
    aug = build_augmentation()
    
    def apply_aug(x, y):
        x = aug(x, training=True)
        return x, y
    
    train_ds = (
        tf.data.Dataset.from_tensor_slices((imgs[:split], lbls[:split]))
        .shuffle(512)
        .batch(batch_size)
        .map(apply_aug)
        .prefetch(tf.data.AUTOTUNE)
    )
    
    valid_ds = (
        tf.data.Dataset.from_tensor_slices((imgs[split:], lbls[split:]))
        .batch(batch_size)
        .prefetch(tf.data.AUTOTUNE)
    )
    
    return train_ds, valid_ds, CLASS_NAMES


# ─── MODEL BUILDING ────────────────────────────────────────────────────
def build_model(num_classes, dropout=0.3):
    """EfficientNetV2-S with classification head for plant diseases."""
    inputs = keras.Input(shape=(IMG_SIZE, IMG_SIZE, 3), name='input_image')
    
    # Backbone: EfficientNetV2-S pretrained on ImageNet
    backbone = keras.applications.EfficientNetV2S(
        include_top=False,
        weights='imagenet',
        input_shape=(IMG_SIZE, IMG_SIZE, 3),
        include_preprocessing=True,  # Normalizes to [-1, 1]
    )
    backbone.trainable = False
    
    x = backbone(inputs, training=False)
    
    # Classification head
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.BatchNormalization()(x)
    x = layers.Dropout(dropout)(x)
    x = layers.Dense(
        512,
        activation='swish',
        kernel_regularizer=keras.regularizers.l2(1e-4)
    )(x)
    x = layers.Dropout(0.2)(x)
    outputs = layers.Dense(
        num_classes,
        activation='softmax',
        kernel_regularizer=keras.regularizers.l2(1e-4)
    )(x)
    
    return keras.Model(inputs, outputs, name='PlantDiseaseClassifier')


# ─── CALLBACKS ─────────────────────────────────────────────────────────
def get_callbacks(output_dir):
    """Callbacks for training."""
    return [
        keras.callbacks.ModelCheckpoint(
            filepath=str(output_dir / "best_model.keras"),
            monitor='val_accuracy',
            save_best_only=True,
            verbose=1,
        ),
        keras.callbacks.EarlyStopping(
            monitor='val_accuracy',
            patience=5,
            restore_best_weights=True,
            verbose=1,
        ),
        keras.callbacks.ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.5,
            patience=3,
            min_lr=1e-7,
            verbose=1,
        ),
        keras.callbacks.CSVLogger(str(output_dir / "training_log.csv")),
    ]


# ─── EXPORT ────────────────────────────────────────────────────────────
def export_model(model, output_dir, class_names):
    """Export SavedModel and metadata."""
    saved_path = output_dir / "saved_model"
    model.export(str(saved_path))
    print(f"✓ SavedModel exported to {saved_path}")
    
    model.save(str(output_dir / "model.keras"))
    
    # Save class names and model info
    model_info = {
        "num_classes": len(class_names),
        "class_names": class_names,
        "input_size": IMG_SIZE,
        "input_dtype": "float32",
        "input_range": [0, 255],
        "architecture": "EfficientNetV2-S",
        "params": int(model.count_params()),
    }
    
    with open(output_dir / "model_info.json", "w") as f:
        json.dump(model_info, f, indent=2)
    print(f"✓ model_info.json saved")
    
    return saved_path


def convert_to_tfjs(saved_model_path, tfjs_dir):
    """Convert SavedModel to TensorFlow.js with float16 quantization."""
    import subprocess
    
    cmd = [
        sys.executable, "-m", "tensorflowjs.converters.converter",
        "--input_format", "tf_saved_model",
        "--output_format", "tfjs_graph_model",
        "--signature_name", "serving_default",
        "--saved_model_tags", "serve",
        "--quantize_float16", "*",
        str(saved_model_path),
        str(tfjs_dir),
    ]
    
    print("🔄 Converting to TensorFlow.js...")
    r = subprocess.run(cmd, capture_output=True, text=True)
    
    if r.returncode == 0:
        files = list(tfjs_dir.glob("*"))
        total_kb = sum(f.stat().st_size for f in files) / 1024
        print(f"✓ TF.js model created ({total_kb:.0f} KB total)")
        for f in sorted(files):
            print(f"  {f.name}: {f.stat().st_size/1024:.1f} KB")
    else:
        print(f"⚠ TF.js conversion warning: {r.stderr[-200:] if r.stderr else 'Unknown error'}")
        print("You can manually convert later with:")
        print(f"  tensorflowjs_converter --input_format=tf_saved_model \\")
        print(f"    --quantize_float16='*' {saved_model_path} {tfjs_dir}")


# ─── MAIN TRAINING ────────────────────────────────────────────────────
def train(args):
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print("\n" + "=" * 70)
    print("  🌿 Plant Disease Classifier — EfficientNetV2-S Training")
    print("=" * 70)
    
    # Load data
    if args.smoke_test:
        print("\n🔥 Mode: SMOKE TEST (synthetic data, quick validation)")
        train_ds, valid_ds, class_names = make_synthetic_dataset(
            NUM_CLASSES, samples=12, img_size=IMG_SIZE, batch_size=4
        )
        p1_epochs, p2_epochs = 2, 3
    else:
        print("\n📥 Mode: FULL TRAINING (real dataset via kagglehub)")
        
        # Download dataset
        base_path = download_dataset_kagglehub()
        
        # Use train/valid directories
        train_dir = os.path.join(base_path, "train")
        valid_dir = os.path.join(base_path, "valid")
        
        train_ds, valid_ds, class_names = make_dataset_from_directories(
            train_dir, valid_dir, IMG_SIZE, BATCH_SIZE
        )
        p1_epochs, p2_epochs = PHASE1_EPOCHS, PHASE2_EPOCHS
    
    # Apply augmentation to training data
    aug = build_augmentation()
    
    def augment(x, y):
        x = aug(x, training=True)
        return x, y
    
    train_ds = train_ds.map(augment, num_parallel_calls=tf.data.AUTOTUNE).prefetch(tf.data.AUTOTUNE)
    valid_ds = valid_ds.prefetch(tf.data.AUTOTUNE)
    
    # Build model
    model = build_model(num_classes=len(class_names))
    total = sum(np.prod(w.shape) for w in model.weights)
    trainable = sum(np.prod(w.shape) for w in model.trainable_weights)
    print(f"\n📊 Model: {len(class_names)} classes")
    print(f"   Total params:     {total:,}")
    print(f"   Trainable params: {trainable:,} (head only)")
    
    # ─── PHASE 1: Train head only ─────────────────────────────────────
    print(f"\n🔥 PHASE 1: Training head ({p1_epochs} epochs, LR={LR_HEAD})")
    model.compile(
        optimizer=keras.optimizers.Adam(LR_HEAD),
        loss=keras.losses.CategoricalCrossentropy(label_smoothing=0.1),
        metrics=['accuracy', keras.metrics.TopKCategoricalAccuracy(k=3, name='top3')],
    )
    
    history1 = model.fit(
        train_ds,
        validation_data=valid_ds,
        epochs=p1_epochs,
        callbacks=get_callbacks(output_dir),
        verbose=1,
    )
    
    best_p1 = max(history1.history['val_accuracy'])
    print(f"\n✓ Phase 1 best val accuracy: {best_p1:.4f}")
    
    # ─── PHASE 2: Fine-tune top 30% of backbone ──────────────────────
    print(f"\n🎯 PHASE 2: Fine-tuning ({p2_epochs} epochs, LR={LR_FINETUNE})")
    
    backbone = model.get_layer('efficientnetv2-s')
    total_layers = len(backbone.layers)
    unfreeze_from = int(total_layers * 0.7)  # Unfreeze top 30%
    
    backbone.trainable = True
    for i, layer in enumerate(backbone.layers):
        layer.trainable = (i >= unfreeze_from)
    
    frozen = sum(1 for l in backbone.layers if not l.trainable)
    unfrozen = sum(1 for l in backbone.layers if l.trainable)
    print(f"   Backbone: {frozen} frozen, {unfrozen} unfrozen layers")
    
    model.compile(
        optimizer=keras.optimizers.Adam(LR_FINETUNE),
        loss=keras.losses.CategoricalCrossentropy(label_smoothing=0.05),
        metrics=['accuracy', keras.metrics.TopKCategoricalAccuracy(k=3, name='top3')],
    )
    
    history2 = model.fit(
        train_ds,
        validation_data=valid_ds,
        epochs=p1_epochs + p2_epochs,
        initial_epoch=p1_epochs,
        callbacks=get_callbacks(output_dir),
        verbose=1,
    )
    
    best_p2 = max(history2.history['val_accuracy'])
    top3 = max(history2.history['val_top3'])
    print(f"\n✅ Training complete!")
    print(f"   Best val accuracy: {best_p2:.4f}")
    print(f"   Best val top-3:    {top3:.4f}")
    
    # Export
    print("\n💾 Exporting model...")
    saved_path = export_model(model, output_dir, class_names)
    
    # Convert to TF.js
    tfjs_dir = output_dir / "tfjs_model"
    tfjs_dir.mkdir(exist_ok=True)
    convert_to_tfjs(saved_path, tfjs_dir)
    
    print("\n" + "=" * 70)
    print("✅ Training complete! Model ready for integration.")
    print("=" * 70)
    print(f"\nOutput directory: {output_dir.absolute()}")
    print(f"\nNext steps:")
    print(f"1. Copy TF.js model to the app:")
    print(f"   cp -r {tfjs_dir}/* ../../public/model/")
    print(f"2. Update app/src/utils/modelInference.ts with class names")
    print(f"3. npm run build && deploy to Vercel")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train plant disease classifier")
    parser.add_argument(
        "--data_source",
        default="kaggle",
        choices=["kaggle", "local"],
        help="Data source: kaggle (uses kagglehub) or local directory"
    )
    parser.add_argument(
        "--train_dir",
        default="./PlantVillage/train",
        help="Path to training directory (if using local)"
    )
    parser.add_argument(
        "--valid_dir",
        default="./PlantVillage/valid",
        help="Path to validation directory (if using local)"
    )
    parser.add_argument(
        "--output_dir",
        default="./output",
        help="Output directory for model artifacts"
    )
    parser.add_argument(
        "--smoke_test",
        action="store_true",
        help="Quick test with synthetic data (no real dataset needed)"
    )
    
    args = parser.parse_args()
    
    train(args)
