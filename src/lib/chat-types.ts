export interface PersistedChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

export interface SharedChatMessage {
  role: "user" | "assistant";
  text: string;
}
