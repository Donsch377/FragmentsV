// Shared prompt definitions for Fragments' on-device LLM flows.
// Keep every instruction string that the bot can see centralized so it is easy to audit.

export type CommandType = "help" | "addFood" | "addRecipe" | "addTask" | "logFood" | "ai" | "orchestratorDemo";

/**
 * JSON schema example used whenever we explain /add food usage to the model.
 */
export const FOOD_COMMAND_TEMPLATE = `/add food {
  "name": "REQUIRED — what pantry item is this?",
  "bestBy": "OPTIONAL — YYYY-MM-DD (omit when missing)",
  "location": "OPTIONAL — where is it stored (Pantry, Freezer, etc.)",
  "barcode": "OPTIONAL — UPC/EAN without spaces",
  "cost": "OPTIONAL — total cost as a string ("5.00")",
  "groupId": "REQUIRED — UUID from accessible groups",
  "groupName": "OPTIONAL — label to show in the UI",
  "catalogId": "OPTIONAL — link to Fragments catalog",
  "imageUrl": "OPTIONAL — public https://… photo",
  "servings": [
    {
      "id": "REQUIRED — stable id like "coke-12oz-1"",
      "label": "REQUIRED — e.g. 1 can (12 fl oz)",
      "amount": "REQUIRED — numeric string",
      "unit": "REQUIRED — grams, ml, fl oz, etc.",
      "barcode": "OPTIONAL — UPC tied to this serving",
      "nutrients": {
        "energy_kcal": "REQUIRED string number",
        "protein_g": "REQUIRED string number",
        "carbs_g": "REQUIRED string number",
        "fat_g": "REQUIRED string number",
        "sat_fat_g": "REQUIRED string number",
        "trans_fat_g": "REQUIRED string number",
        "fiber_g": "REQUIRED string number",
        "sugar_g": "REQUIRED string number",
        "sodium_mg": "REQUIRED string number"
      }
    }
  ]
}`;

/**
 * JSON schema example used whenever we explain /add recipe usage to the model.
 */
export const RECIPE_COMMAND_TEMPLATE = `/add recipe {
  "title": "REQUIRED — display title",
  "groupId": "REQUIRED — UUID from accessible groups",
  "groupName": "OPTIONAL — label to show in the UI",
  "imageUrl": "OPTIONAL — hosted photo",
  "sourceUrl": "OPTIONAL — where this recipe came from",
  "ingredients": [
    {
      "id": "REQUIRED — "ingredient-1" so steps can reference it",
      "name": "REQUIRED",
      "quantity": "REQUIRED",
      "unit": "OPTIONAL",
      "notes": "OPTIONAL"
    }
  ],
  "steps": [
    {
      "id": "REQUIRED — "step-1"",
      "title": "REQUIRED — short label",
      "body": "REQUIRED — paragraph of instructions",
      "requires": ["OPTIONAL — list of prior step ids"],
      "ingredients": [
        {
          "ingredientId": "REQUIRED — must match ingredients[].id",
          "quantity": "REQUIRED",
          "unit": "OPTIONAL"
        }
      ],
      "databox": [
        {
          "id": "REQUIRED — "databox-1"",
          "title": "REQUIRED",
          "expression": "REQUIRED — can reference other databox ids"
        }
      ]
    }
  ],
  "nutrition": [
    {
      "id": "REQUIRED",
      "label": "REQUIRED — e.g. calories",
      "value": "REQUIRED string number",
      "unit": "REQUIRED",
      "per": "REQUIRED — e.g. serving"
    }
  ]
}`;

/**
 * JSON schema example used whenever we explain /add task usage to the model.
 */
export const TASK_COMMAND_TEMPLATE = `/add task {
  "title": "REQUIRED",
  "notes": "OPTIONAL string",
  "groupId": "REQUIRED — UUID from accessible groups",
  "groupName": "OPTIONAL — label to show in the UI",
  "startDate": "OPTIONAL — YYYY-MM-DD",
  "startTime": "OPTIONAL — HH:MM",
  "dueDate": "OPTIONAL — YYYY-MM-DD",
  "dueTime": "OPTIONAL — HH:MM",
  "link": {
    "text": "OPTIONAL — context",
    "pantryId": "OPTIONAL",
    "recipeId": "OPTIONAL"
  },
  "assignees": ["OPTIONAL — display names"],
  "checklist": [
    {
      "id": "REQUIRED",
      "label": "REQUIRED",
      "done": "OPTIONAL — boolean"
    }
  ]
}`;

/**
 * JSON schema example used whenever we explain /log food usage to the model.
 */
export const FOOD_LOG_COMMAND_TEMPLATE = `/log food {
  "mode": "existing | manual",
  "groupId": "OPTIONAL — defaults to the pantry group when mode=existing",
  "groupName": "OPTIONAL — label for the group",
  "loggedDate": "OPTIONAL — YYYY-MM-DD (defaults to today)",
  "quantity": "OPTIONAL — number or string (defaults to 1)",
  "notes": "OPTIONAL — string",
  "foodId": "REQUIRED when mode=existing — pantry food UUID",
  "servingId": "OPTIONAL when mode=existing — pantry serving UUID",
  "manual": {
    "name": "REQUIRED when mode=manual",
    "imageUrl": "OPTIONAL",
    "groupName": "OPTIONAL — overrides top-level groupName",
    "servingLabel": "REQUIRED when mode=manual",
    "servingAmount": "OPTIONAL — number or string",
    "servingUnit": "OPTIONAL",
    "nutrients": {
      "energy_kcal": "OPTIONAL string or number",
      "protein_g": "... other nutrient keys ...",
      "carbs_g": "",
      "fat_g": "",
      "sat_fat_g": "",
      "trans_fat_g": "",
      "fiber_g": "",
      "sugar_g": "",
      "sodium_mg": ""
      
    }
  }
}`;

const GENERAL_RULE_LINES = [
  "Fragments AI Command Rules (v2)",
  "",
  "General",
  "• Every /add command must be followed by exactly one valid JSON object.",
  "• NEVER use smart / curly quotes. Use only plain ASCII double quotes: \".",
  "• Bad: “name”",
  "• Good: \"name\"",
  "• Do not add comments inside the JSON.",
  "• Do not include trailing commas.",
  "• If you don’t know a value for an optional field, omit the field entirely instead of using an empty string.",
  "• All numbers must be sent as strings (for example \"140\", not 140), unless otherwise specified.",
];

export const COMMAND_RULES: Record<CommandType, string> = {
  help: [
    "/help (alias /commands)",
    "• Returns a concise summary of every slash command.",
    "• Use whenever you need a refresher during a conversation.",
  ].join("\n"),
  addFood: [
    "/add food",
    "",
    "Immediately after /add food output only a JSON object with this shape:",
    FOOD_COMMAND_TEMPLATE,
    "Rules for /add food:",
    "• name and groupId are always required.",
    "• servings must contain at least one serving object.",
    "• id should be a stable unique ID for that serving in the context of this item (e.g. \"coke-12oz-1\").",
    "• If a value is unknown for bestBy, location, barcode, cost, groupName, catalogId, or imageUrl, simply omit that key from the JSON.",
    "• All nutrient values are strings representing numbers (e.g. \"0\", \"39\", \"140\").",
    "",
    "Output format example (valid):",
    "",
    "/add food {",
    '  "name": "Coca-Cola (Can)",',
    '  "bestBy": "2026-12-31",',
    '  "location": "Pantry",',
    '  "barcode": "049000050103",',
    '  "cost": "20.00",',
    '  "groupId": "group-123",',
    '  "groupName": "My Pantry",',
    '  "catalogId": "coke-12oz",',
    '  "imageUrl": "https://example.com/coke-can.jpg",',
    '  "servings": [',
    '    {',
    '      "id": "coke-can-12oz",',
    '      "label": "1 can (12 fl oz)",',
    '      "amount": "1",',
    '      "unit": "can",',
    '      "barcode": "049000050103",',
    '      "nutrients": {',
    '        "energy_kcal": "140",',
    '        "protein_g": "0",',
    '        "carbs_g": "39",',
    '        "fat_g": "0",',
    '        "sat_fat_g": "0",',
    '        "trans_fat_g": "0",',
    '        "fiber_g": "0",',
    '        "sugar_g": "39",',
    '        "sodium_mg": "45"',
    '      }',
    '    }',
    '  ]',
    '}\n',
    "",
    "• No explanations before or after.",
    "• No backticks in the actual command the system will parse.",
    "• Only the /add food prefix followed by that single JSON object.",
  ].join("\n"),
  addRecipe: [
    "/add recipe",
    "",
    "Immediately after /add recipe output only a JSON object with this structure:",
    RECIPE_COMMAND_TEMPLATE,
    "Rules for /add recipe:",
    "• title and groupId are required.",
    "• Every ingredient/step/nutrition/databox entry must include its id so the builder can match references.",
    "• requires must list prior step ids whenever sequencing matters.",
    "• databox expressions should mirror the manual form and can reference other databox ids.",
  ].join("\n"),
  addTask: [
    "/add task",
    "",
    "Immediately after /add task output only a JSON object with this structure:",
    TASK_COMMAND_TEMPLATE,
    "Rules for /add task:",
    "• title and groupId are required.",
    "• link can include any combination of text, pantryId, and recipeId.",
    "• assignees accepts an array of display names; omit the key if nobody is assigned yet.",
  ].join("\n"),
  logFood: [
    "/log food",
    "",
    "Immediately after /log food output only a JSON object with this structure:",
    FOOD_LOG_COMMAND_TEMPLATE,
    "Rules for /log food:",
    "• Set mode to \"existing\" when logging a pantry item by ID; include foodId and (optionally) servingId.",
    "• Set mode to \"manual\" when no pantry item exists; include manual.name and manual.servingLabel plus any nutrient data you have.",
    "• quantity defaults to 1 if omitted. Use decimal strings (\"0.5\") when needed.",
    "• loggedDate defaults to today if omitted.",
    "• groupId is optional. When mode=existing and you omit it, the pantry item’s group is used automatically.",
    "• If you don’t know a nutrient value, omit that field under manual.nutrients entirely.",
  ].join("\n"),
  ai: [
    "/ai",
    "• Outputs these rules verbatim and copies them to the clipboard so another AI can read them.",
    "• Never add extra commentary or pre/post text when sharing.",
    "• Remind copilots that commands can be chained by sending one slash command per line.",
  ].join("\n"),
  orchestratorDemo: [
    "/orchestrator",
    "• Runs the orchestrator demo that fakes two pantry images and builds /add food commands for each detected item.",
    "• Use this to verify the on-device tool pipeline without uploading real photos.",
  ].join("\n"),
};

const MULTI_COMMAND_GUIDANCE = [
  "Multi-command guidance",
  "- Send commands one per line or in separate messages. Each line must start with the slash keyword.",
  "- Example:",
  "  /add food {...}",
  "  /add task {...}",
  "- The assistant executes the commands sequentially and reports results after each one.",
];

/**
 * Complete rulebook fed to copilots (via /ai and /help results) so they know how to format slash commands.
 */
export const buildRulesPrompt = (groupLines: string[]) =>
  [
    ...GENERAL_RULE_LINES,
    "",
    COMMAND_RULES.help,
    "",
    COMMAND_RULES.addFood,
    "",
    COMMAND_RULES.addRecipe,
    "",
    COMMAND_RULES.addTask,
    "",
    COMMAND_RULES.logFood,
    "",
    COMMAND_RULES.ai,
    "",
    ...MULTI_COMMAND_GUIDANCE,
    "",
    "Accessible groups",
    ...groupLines,
  ].join("\n");

/**
 * Conversational system prompt given to the local LLM for normal chat turns.
 */
export const createConversationalPrompt = (groupLines: string[]) =>
  [
    "You are Fragments' offline assistant that runs locally on this device.",
    "You do NOT execute commands yourself. Instead, explain the slash commands a user should run when structured actions are needed.",
    "Follow the JSON contracts from /help when sharing sample commands, and keep replies concise.",
    "Whenever you output an actionable command, it MUST start with '/', never with '!'.",
    "Prefer returning commands directly like `/log food { ... }` instead of describing steps with prose.",
    "Accessible groups:",
    ...groupLines,
  ].join("\n");

/**
 * Used when we ask the LLM to resume output after truncation mid-response.
 */
export const CONTINUE_SYSTEM_PROMPT =
  "Continue the previous response verbatim from the exact point it stopped. Do not repeat the earlier sentences, only finish the answer.";

/**
 * Initial greeting shown in the chat log so users know how to interact with the AI console.
 */
export const INITIAL_SYSTEM_GREETING =
  "Welcome to the Fragments AI console. Run /help to see the JSON-based slash commands.";
