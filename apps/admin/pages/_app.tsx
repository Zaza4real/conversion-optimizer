import type { AppProps } from 'next/app';
import { AppProvider as PolarisAppProvider } from '@shopify/polaris';
import '@shopify/polaris/build/esm/styles.css';

export default function App({ Component, pageProps }: AppProps) {
  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY || '';
  const isEmbedded = typeof window !== 'undefined' && window.location !== window.parent.location;

  return (
    <PolarisAppProvider
      i18n={{}}
      linkComponent={({ children, url, ...rest }) => (
        <a href={url} {...rest}>
          {children}
        </a>
      )}
      {...(apiKey && isEmbedded ? { apiKey, isEmbedded: true } : {})}
    >
      <Component {...pageProps} />
    </PolarisAppProvider>
  );
}
