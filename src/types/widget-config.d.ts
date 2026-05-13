import type { RTGChatConfig } from "@/lib/widget-config";

declare global {
  interface Window {
    RTG_CHAT_CONFIG?: RTGChatConfig;
  }
}

export {};
