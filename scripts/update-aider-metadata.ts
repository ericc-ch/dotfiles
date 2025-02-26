import * as path from "jsr:@std/path";

const COPILOT_API_BASE = "http://localhost:4141";
const AIDER_CONFIG_PATH = path.join(
  Deno.cwd(),
  "aider",
  ".aider.model.metadata.json"
);

async function fetchModels(): Promise<ModelsResponse> {
  const response = await fetch(new URL("/models", COPILOT_API_BASE));
  const data = await response.json();
  return data as ModelsResponse;
}

const currentConfig = JSON.parse(
  Deno.readTextFileSync(AIDER_CONFIG_PATH)
) as ModelSpecs;

const models = await fetchModels();

console.log(models);
console.log(currentConfig);

// Helper function to convert API model data to Aider spec format
function convertModelToSpec(model: Model): ModelSpec {
  return {
    max_input_tokens:
      model.capabilities.limits.max_prompt_tokens ??
      model.capabilities.limits.max_context_window_tokens,
    max_output_tokens: model.capabilities.limits.max_output_tokens,
    input_cost_per_token: 0.0, // Will preserve existing values later
    output_cost_per_token: 0.0, // Will preserve existing values later
    litellm_provider: "openai", // May need adjustment based on vendor
    mode: model.capabilities.type as ModelSpec["mode"],
    supports_function_calling: model.capabilities.supports.tool_calls ?? false,
    supports_parallel_function_calling:
      model.capabilities.supports.parallel_tool_calls ?? false,
    supports_vision: model.capabilities.supports.vision ?? false,
    supports_audio_input: false,
    supports_audio_output: false,
    supports_prompt_caching: false,
    supports_response_schema:
      model.capabilities.supports.structured_outputs ?? false,
    supports_system_messages: true,
  };
}

// Build updated metadata
const updatedSpecs: ModelSpecs = {
  sample_spec: currentConfig.sample_spec, // Preserve sample spec
};

// Process each model from the API response
for (const model of models.data) {
  // Skip models that are not enabled or are embedding models
  if (
    model.policy?.state !== "enabled" ||
    model.capabilities.type === "embeddings"
  ) {
    continue;
  }

  // Create normalized model name
  const modelName = `openai/${model.id.toLowerCase()}`;

  // Convert model data to spec format
  const spec = convertModelToSpec(model);

  // Preserve existing costs if available
  if (currentConfig[modelName]) {
    spec.input_cost_per_token = currentConfig[modelName].input_cost_per_token;
    spec.output_cost_per_token = currentConfig[modelName].output_cost_per_token;
  }

  updatedSpecs[modelName] = spec;
}

// Write updated metadata back to file
await Deno.writeTextFile(
  AIDER_CONFIG_PATH,
  JSON.stringify(updatedSpecs, null, 2)
);

console.log(
  "Updated metadata file with",
  Object.keys(updatedSpecs).length - 1,
  "models"
); // -1 for sample_spec

/**
 *
 * Type definitions
 *
 */

// Models endpoint response

interface ModelCapabilities {
  family: string;
  limits: {
    max_context_window_tokens?: number;
    max_output_tokens?: number;
    max_prompt_tokens?: number;
    max_inputs?: number;
    vision?: {
      max_prompt_image_size: number;
      max_prompt_images: number;
      supported_media_types: string[];
    };
  };
  object: "model_capabilities";
  supports: {
    streaming?: boolean;
    tool_calls?: boolean;
    parallel_tool_calls?: boolean;
    vision?: boolean;
    structured_outputs?: boolean;
    dimensions?: boolean;
  };
  tokenizer: string;
  type: "chat" | "embeddings";
}

interface ModelPolicy {
  state: "enabled" | string; // Assuming "enabled" is one possible state, and there might be others
  terms: string;
}

interface Model {
  capabilities: ModelCapabilities;
  id: string;
  model_picker_enabled: boolean;
  name: string;
  object: "model";
  preview: boolean;
  vendor: "Azure OpenAI" | "Anthropic" | "Google"; // Add other vendors if you know them
  version: string;
  policy?: ModelPolicy; // Policy is optional based on the JSON provided
}

interface ModelsResponse {
  data: Model[];
  object: "list";
}

// Aider model metadata

interface ModelSpec {
  /**
   * @deprecated
   */
  max_tokens?: string; // LEGACY parameter
  max_input_tokens?: number;
  max_output_tokens?: number;
  input_cost_per_token: number;
  output_cost_per_token: number;
  litellm_provider: string;
  mode:
    | "chat"
    | "embedding"
    | "completion"
    | "image_generation"
    | "audio_transcription"
    | "audio_speech";
  supports_function_calling: boolean;
  supports_parallel_function_calling: boolean;
  supports_vision: boolean;
  supports_audio_input: boolean;
  supports_audio_output: boolean;
  supports_prompt_caching: boolean;
  supports_response_schema: boolean;
  supports_system_messages: boolean;
  deprecation_date?: string; // YYYY-MM-DD
}

interface ModelSpecs {
  sample_spec: ModelSpec;
  [modelName: string]: ModelSpec; // Index signature to allow arbitrary model names as keys
}
