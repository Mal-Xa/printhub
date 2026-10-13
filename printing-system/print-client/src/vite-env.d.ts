/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PRINT_SERVER_URL: string;
  readonly VITE_CLIENT_USER_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
