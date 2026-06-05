/**
 * Local Model Inference — Browser-based Plant Disease Classification
 * 
 * This module loads and runs the TensorFlow.js model entirely in the browser.
 * No API calls, no rate limits, works offline.
 * 
 * Features:
 * - Loads model from public/model/ directory
 * - Runs inference on WebGL GPU (or CPU fallback)
 * - Returns top 3 predictions with confidence scores
 * - ~50-200ms inference time on modern devices
 */

import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';

interface ModelInfo {
  num_classes: number;
  class_names: string[];
  input_size: number;
  input_dtype: string;
  input_range: [number, number];
  architecture: string;
  params: number;
}

interface Prediction {
  diseaseLabel: string;
  confidence: number;
  cropName: string;
}

interface InferenceResult {
  predictions: Prediction[];
  inferenceTime: number;
  modelVersion: string;
}

class ModelInference {
  private model: tf.GraphModel | null = null;
  private modelInfo: ModelInfo | null = null;
  private isLoading = false;
  private modelPath = '/model/model.json';
  private infoPath = '/model/model_info.json';

  /**
   * Initialize the model (download and load if not already loaded)
   */
  async initialize(): Promise<void> {
    if (this.model) return; // Already loaded

    if (this.isLoading) {
      // Wait for concurrent initialization to complete
      while (this.isLoading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return;
    }

    this.isLoading = true;
    try {
      // Set backend
      const backend = await tf.backend();
      console.log(`📊 TF.js backend: ${backend}`);

      // Load model info first
      const infoRes = await fetch(this.infoPath);
      if (!infoRes.ok) {
        throw new Error(`Failed to load model_info.json: ${infoRes.status}`);
      }
      this.modelInfo = await infoRes.json();
      console.log(`✓ Model info loaded: ${this.modelInfo.num_classes} classes, ${this.modelInfo.params} params`);

      // Load model
      console.log(`📥 Loading model from ${this.modelPath}...`);
      this.model = await tf.loadGraphModel(this.modelPath);
      console.log(`✓ Model loaded successfully`);

    } catch (error) {
      this.isLoading = false;
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to initialize model: ${msg}`);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Run inference on an image canvas
   * @param canvas HTML canvas with the leaf image
   * @returns Predictions with confidence scores
   */
  async predict(canvas: HTMLCanvasElement): Promise<InferenceResult> {
    if (!this.model || !this.modelInfo) {
      await this.initialize();
    }

    if (!this.model || !this.modelInfo) {
      throw new Error('Model failed to initialize');
    }

    const startTime = performance.now();

    // Prepare input tensor
    const inputSize = this.modelInfo.input_size;
    const tensor = tf.tidy(() => {
      // Convert canvas to tensor
      let img = tf.browser.fromPixels(canvas, 3);

      // Resize to model input size
      if (canvas.width !== inputSize || canvas.height !== inputSize) {
        img = tf.image.resizeBilinear(img, [inputSize, inputSize]);
      }

      // Ensure uint8 range [0, 255]
      img = tf.cast(img, 'uint8');

      // Add batch dimension
      const batch = tf.expandDims(img, 0);
      return batch;
    });

    try {
      // Run inference
      const predictions = this.model.predict(tensor) as tf.Tensor;

      // Get results
      const probs = await predictions.data() as Float32Array;
      const inferenceTime = performance.now() - startTime;

      // Find top 3 predictions
      const indices = Array.from(probs)
        .map((prob, idx) => ({ prob, idx }))
        .sort((a, b) => b.prob - a.prob)
        .slice(0, 3);

      const classNames = this.modelInfo.class_names;
      const results: Prediction[] = indices.map(({ prob, idx }) => {
        const label = classNames[idx];
        const [crop, disease] = label.split('___');

        return {
          diseaseLabel: label,
          confidence: Math.max(0, Math.min(1, prob)), // Clamp to [0, 1]
          cropName: crop.replace(/_/g, ' ').replace(/,.*/, '').trim(),
        };
      });

      console.log(`✓ Inference complete in ${inferenceTime.toFixed(0)}ms`);

      return {
        predictions: results,
        inferenceTime,
        modelVersion: this.modelInfo.architecture,
      };

    } finally {
      tensor.dispose();
    }
  }

  /**
   * Get model info
   */
  getModelInfo(): ModelInfo | null {
    return this.modelInfo;
  }

  /**
   * Dispose of model and free memory
   */
  dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
    tf.disposeVariables();
  }
}

// Singleton instance
let instance: ModelInference | null = null;

/**
 * Get or create the inference instance
 */
export function getModelInference(): ModelInference {
  if (!instance) {
    instance = new ModelInference();
  }
  return instance;
}

/**
 * Initialize model and get ready for inference
 */
export async function initializeModel(): Promise<ModelInfo> {
  const inference = getModelInference();
  await inference.initialize();
  const info = inference.getModelInfo();
  if (!info) throw new Error('Failed to load model info');
  return info;
}

/**
 * Run inference on a canvas
 */
export async function runInference(canvas: HTMLCanvasElement): Promise<InferenceResult> {
  const inference = getModelInference();
  return inference.predict(canvas);
}

/**
 * Clean up resources
 */
export function disposeModel(): void {
  if (instance) {
    instance.dispose();
    instance = null;
  }
}
