interface ViteTypeOptions {
  strictImportMetaEnv: unknown
}

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: strin
  readonly VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
