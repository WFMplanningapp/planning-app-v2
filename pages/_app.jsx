import 'bulma/css/bulma.min.css';
import '../styles/globals.css';
import 'bulma/css/bulma.css';

import Head from 'next/head';

import { AuthProvider } from '../contexts/authContext';
import PageLayout from '../layout/pageLayout';

function MyApp({ Component, pageProps }) {
  return (
    <>
      <Head>
        <meta name="description" content="Planning App" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon-32x32.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" />

        <link
          href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;600;700&display=swap"
          rel="stylesheet"
        ></link>
      </Head>

      <AuthProvider>
        <PageLayout>
          <Component {...pageProps} />
        </PageLayout>
      </AuthProvider>
    </>
  );
}

export default MyApp;
