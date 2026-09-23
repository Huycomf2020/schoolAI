export const APP_CONFIG = {
  supabaseUrl: "https://ckviatjyhrhfhejugkgs.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJIUzI1NiIsInJlZiI6ImNrdmlhdGp5aHJoZmhlanVna2dzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxNTYwNjUsImV4cCI6MjEwNTczMjA2NX0.-JngXSlDr63UYDRMbhaAordyKSuXcDczUrX7WUBcXgU",
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
