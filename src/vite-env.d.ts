/// <reference types="vite/client" />

export interface ImportMetaEnv {
    readonly VITE_APP_TITLE: string
    // more env variables...
    readonly VITE_TURN_SERVER_KEY: string
    readonly VITE_TURN_SERVER_PASS: string
    readonly VITE_GOOGLE_API_KEY: string
    readonly VITE_GOOGLE_CLIENT_ID: string
}

export interface ImportMeta {
    readonly env: ImportMetaEnv
}