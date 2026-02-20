'use client';

import { SessionProvider } from 'next-auth/react';
// Importing the Bootstrap CSS
import 'bootstrap/dist/css/bootstrap.min.css';
import '../styles/bootstrap.min-musiccpr.css';
import '../styles/global.css';
import '../styles/daw-styles.css';
import '../styles/daw-multitrack.css';
import '../styles/daw-track-controls.css';
import '../styles/daw-waveforms.css';
import '../styles/daw-midi.css';
import '../styles/daw-transport.css';
import '../styles/effectsRack.css';
import { ReactQueryDevtools } from 'react-query/devtools';
import { QueryClient, QueryClientProvider } from 'react-query';
import wrapper from '../store';

function App({ Component, pageProps: { session, ...pageProps } }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
      },
    },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider session={session}>
        {
          // eslint-disable-next-line react/jsx-props-no-spreading
          <Component {...pageProps} />
        }
      </SessionProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

export default wrapper.withRedux(App);
