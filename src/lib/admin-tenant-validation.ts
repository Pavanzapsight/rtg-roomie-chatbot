export interface TenantCreateFormValues {
  name: string;
  tenantKey: string;
  appName: string;
  appUrl: string;
  domains: string;
  assistantName: string;
  headerTitle: string;
  launcherLabel: string;
  inputPlaceholder: string;
  supportUrl: string;
  storeLocatorUrl: string;
  handoffDescription: string;
}

export type TenantCreateFormErrors = Partial<Record<keyof TenantCreateFormValues, string>>;

export const EMPTY_TENANT_CREATE_FORM_VALUES: TenantCreateFormValues = {
  name: "",
  tenantKey: "",
  appName: "",
  appUrl: "",
  domains: "",
  assistantName: "",
  headerTitle: "",
  launcherLabel: "",
  inputPlaceholder: "",
  supportUrl: "",
  storeLocatorUrl: "",
  handoffDescription: "",
};

const TENANT_KEY_PATTERN = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;
const HOSTNAME_PATTERN = /^(?:\*\.)?(?:localhost|(?:\d{1,3}\.){3}\d{1,3}|(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*)$/i;

function readValue(value: FormDataEntryValue | string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidHostname(value: string): boolean {
  if (!value || value.includes("://") || value.includes("/") || value.includes("?")) {
    return false;
  }

  if (!HOSTNAME_PATTERN.test(value)) {
    return false;
  }

  if (value.includes(".")) {
    const ipv4Match = value.match(/^(?:\d{1,3}\.){3}\d{1,3}$/);
    if (ipv4Match) {
      return value.split(".").every((segment) => Number(segment) >= 0 && Number(segment) <= 255);
    }
  }

  return true;
}

export function normalizeTenantCreateFormValues(
  input: Partial<Record<keyof TenantCreateFormValues, FormDataEntryValue | string | null | undefined>>
): TenantCreateFormValues {
  return {
    name: readValue(input.name),
    tenantKey: readValue(input.tenantKey).toLowerCase(),
    appName: readValue(input.appName),
    appUrl: readValue(input.appUrl),
    domains: readValue(input.domains).toLowerCase(),
    assistantName: readValue(input.assistantName),
    headerTitle: readValue(input.headerTitle),
    launcherLabel: readValue(input.launcherLabel),
    inputPlaceholder: readValue(input.inputPlaceholder),
    supportUrl: readValue(input.supportUrl),
    storeLocatorUrl: readValue(input.storeLocatorUrl),
    handoffDescription: readValue(input.handoffDescription),
  };
}

export function parseTenantDomains(domains: string): string[] {
  return domains
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function validateTenantCreateFormValues(
  values: TenantCreateFormValues
): TenantCreateFormErrors {
  const errors: TenantCreateFormErrors = {};

  if (!values.name) {
    errors.name = "Tenant name is required.";
  }

  if (!values.tenantKey) {
    errors.tenantKey = "Tenant key is required.";
  } else if (!TENANT_KEY_PATTERN.test(values.tenantKey)) {
    errors.tenantKey = "Use lowercase letters, numbers, dashes, or underscores only.";
  }

  if (values.appUrl && !isHttpUrl(values.appUrl)) {
    errors.appUrl = "Enter a full website URL starting with http:// or https://.";
  }

  if (values.supportUrl && !isHttpUrl(values.supportUrl)) {
    errors.supportUrl = "Enter a valid support URL starting with http:// or https://.";
  }

  if (values.storeLocatorUrl && !isHttpUrl(values.storeLocatorUrl)) {
    errors.storeLocatorUrl = "Enter a valid store locator URL starting with http:// or https://.";
  }

  const invalidDomain = parseTenantDomains(values.domains).find(
    (domain) => !isValidHostname(domain)
  );
  if (invalidDomain) {
    errors.domains = `\"${invalidDomain}\" is not a valid hostname. Use hostnames only, without https://.`;
  }

  return errors;
}