import { Layout } from 'app/layout/layout.types';

// Types
export type Scheme = 'auto' | 'dark' | 'light';
export type Theme = 'default' | string;

/**
 * AppConfig interface. Update this interface to strictly type your config
 * object.
 */
export interface AppConfig
{
    layout: Layout;
    scheme: Scheme;
    theme: Theme;
}

/**
 * Default configuration for the entire application. This object is used by
 * FuseConfigService to set the default configuration.
 *
 * If you need to store global configuration for your app, you can use this
 * object to set the defaults. To access, update and reset the config, use
 * FuseConfigService and its methods.
 */
export const appConfig: AppConfig = {
    // The storefront is the default, so anything not explicitly labelled renders as a
    // public shop page. The /admin route block therefore MUST declare
    // `data: {layout: 'classy'}` — it previously relied on inheriting 'classy' from
    // here, and without that declaration the admin area would render in store chrome.
    layout: 'storefront',
    scheme: 'light',
    theme : 'rose'
};
