export const APP_CONFIG = {
  supabaseUrl: "https://ckviatjyhrhfhejugkgs.supabase.co",
  supabaseAnonKey: "sb_publishable_Ltc5Qw7_DXYmCAVgDjtfAg__TZbF5Yz",
  functionName: "ai-assistant",
  basicPromptLimit: 600,
  basicDailyLimit: 30,
  advancedDailyLimit: 15
};

export const MODEL_CATALOG = {
  openai: [
    { id: "gpt-6-luna", label: "GPT-6 Luna • tiết kiệm" },
    { id: "gpt-6-sol", label: "GPT-6 Sol • cân bằng" }
  ],
  gemini: [
    { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite • tiết kiệm" },
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash • ổn định" }
  ]
};
