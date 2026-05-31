# Model Training Guide

## Option A: Google Colab (recommended — free GPU)
1. Open `PlantDisease_Train_EfficientNetV2.ipynb` in Google Colab
2. Set runtime to T4 GPU: `Runtime → Change runtime type → T4 GPU`
3. Run all cells (~25 minutes)
4. Download `tfjs_model.zip` from the last cell
5. Extract into `../public/model/`

## Option B: Local training
```bash
pip install -r requirements.txt

# Download PlantVillage dataset:
# https://www.kaggle.com/datasets/emmarex/plantdisease
# Extract to ./PlantVillage/

python train_model.py --data_dir ./PlantVillage --output_dir ./output

# Copy result to app:
cp -r output/tfjs_model/* ../public/model/
cp output/model_info.json ../public/model/
```

## Option C: Smoke test (no dataset needed)
```bash
python train_model.py --smoke_test
```

## Architecture
- **Model:** EfficientNetV2-S (Colab) or custom MBConv (local)
- **Input:** 224×224×3 RGB, values [0, 255]
- **Output:** 38-class softmax
- **TF.js size:** ~8MB after float16 quantization
- **Expected accuracy:** ~96% val accuracy on PlantVillage

## After training
Place these files in `public/model/`:
```
public/model/
  model.json
  group1-shard1of4.bin
  group1-shard2of4.bin
  ...
  model_info.json
```
