import {
  DEFAULT_WIDGET_BRANDING,
  getWelcomeMessage,
  type WidgetBranding,
} from "@/lib/widget-config";

export const WELCOME_MESSAGE = getWelcomeMessage(DEFAULT_WIDGET_BRANDING);

export function getBrandedWelcomeMessage(
  branding: Pick<WidgetBranding, "assistantName">
): string {
  return getWelcomeMessage({
    ...DEFAULT_WIDGET_BRANDING,
    ...branding,
  });
}
