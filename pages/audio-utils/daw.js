'use client';

import { useEffect } from 'react';
import Layout from '../../components/layout';
import DAW from '../../components/audio/DAW';
import { DAWProvider, useAudio, useUI } from '../../contexts/DAWProvider';

// Component that sets the initial audio URL
const DAWWithInitialAudio = ({ url }) => {
  const { setAudioURL } = useAudio();
  const { setShowDAW } = useUI();
  
  useEffect(() => {
    if (url) {
      setAudioURL(url);
      setShowDAW(true);
    }
  }, [url, setAudioURL, setShowDAW]);
  
  return <DAW />;
};

const DawEditorSimple = () => {
  const url = '/sample_audio/uncso-bruckner4-1.mp3';

  return (
    <Layout>
      <DAWProvider>
        <DAWWithInitialAudio url={url} />
      </DAWProvider>
    </Layout>
  );
}

export default DawEditorSimple;