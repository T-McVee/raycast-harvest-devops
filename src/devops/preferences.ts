import { getPreferenceValues } from "@raycast/api";

interface AzureDevOpsPreferences {
  adoPersonalAccessToken: string;
  adoEmail: string;
  adoOrganizationURL: string;
  adoOrganizationName: string;
  adoProjectName: string | undefined;
}

const { adoPersonalAccessToken, adoOrganizationName, adoProjectName, adoEmail, adoOrganizationURL } =
  getPreferenceValues<AzureDevOpsPreferences>();

export const ADO_PAT = adoPersonalAccessToken;
export const ADO_ORGANIZATION_NAME = adoOrganizationName;
export const ADO_ORGANIZATION_URL = adoOrganizationURL;
export const ADO_PROJECT_NAME = adoProjectName;
export const ADO_EMAIL = adoEmail;

export function preparedPersonalAccessToken(): string {
  if (!adoPersonalAccessToken) {
    throw new Error("Azure DevOps Personal Access Token is not set");
  }
  return Buffer.from(":" + adoPersonalAccessToken, "binary").toString("base64");
}

export function baseApiUrl(): string {
  if (!adoOrganizationName) {
    throw new Error("Azure DevOps Organization Name is not set");
  }
  return `https://dev.azure.com/${adoOrganizationName}`;
}

export function baseApiUrlEntities(): string {
  if (!adoOrganizationName) {
    throw new Error("Azure DevOps Organization Name is not set");
  }
  return `https://vssps.dev.azure.com/${adoOrganizationName}`;
}
