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

// export const PROJECT_NAME = "Report Once Solution (RoS) for eHealth";
// export const PROJECT_ID = "7039ae20-af42-430d-9db6-943c3167264b";

// export const TEAM_NAME = "00821.26 Minor enhancements";
// export const TEAM_ID = "9fbbd774-3802-4f00-8baa-40a13512d7ec";

// export const ITERATION_ID = "14b18204-b64f-4a5e-9402-227241d057a2";
