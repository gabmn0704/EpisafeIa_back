import { loadConfig, type AppConfig } from '../config/env';

/**
 * Patrón Singleton: una única instancia de configuración por proceso.
 * `reset` existe solo para pruebas.
 */
export class ConfigProvider {
  private static instance: ConfigProvider | null = null;

  private constructor(readonly config: AppConfig) {}

  static getInstance(env: NodeJS.ProcessEnv = process.env): ConfigProvider {
    if (!ConfigProvider.instance) ConfigProvider.instance = new ConfigProvider(loadConfig(env));
    return ConfigProvider.instance;
  }

  static reset(): void {
    ConfigProvider.instance = null;
  }
}

export const getConfig = (): AppConfig => ConfigProvider.getInstance().config;
