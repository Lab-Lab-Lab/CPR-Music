'use client';

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardSubtitle,
  CardTitle,
  Form,
  FormCheck,
  FormControl,
  FormLabel,
  FormText,
} from 'react-bootstrap';

import { catchSilence, loadFfmpeg } from '../../lib/dawUtils';
import { AudioDropModal } from './silenceDetect';

const URL = '/sample_audio/uncso-bruckner4-1.mp3';

export default function SilenceSandboxComponent() {
  const ffmpegRef = useRef(new FFmpeg());
  const [loaded, setLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fileFlagged, setFileFlagged] = useState(false);
  const [noiseTolerance, setNoiseTolerance] = useState(0);
  const [silenceDuration, setSilenceduration] = useState(0);
  const [fileSilenceData, setFileSilenceData] = useState(null);
  const [multichannelScan, setMultichannelScan] = useState(false);

  if (!loaded) loadFfmpeg(ffmpegRef, setLoaded, setIsLoading);

  useEffect(() => {
    console.log(
      `values: n=${noiseTolerance}, d=${silenceDuration}, m=${multichannelScan}`
    );
  }, [noiseTolerance, silenceDuration, multichannelScan]);

  const scan = useCallback(async () => {
    if (!loaded) return;

    const { silences, numSilences, silenceFlag } = await catchSilence(
      ffmpegRef,
      URL,
      noiseTolerance,
      silenceDuration,
      multichannelScan ? true : null
    );
    console.log('returned; Num silence: ', numSilences);

    if (silenceFlag) {
      setFileFlagged(true);
      setFileSilenceData({ silences: silences, numSilences: numSilences });
    }
  });

  return (
    <>
      <Card
        className="ml-auto mr-auto mt-3"
        style={{ width: '100%', maxWidth: '600px', borderColor: 'steelblue', borderWidth: '1.6px' }}
      >
        <CardHeader style={{ backgroundColor: 'steelblue' }}>
          <CardTitle className="text-white" style={{ fontSize: '1.4rem' }}>
            got Silence?
          </CardTitle>
          <CardSubtitle
            className=""
            style={{ color: 'rgba(186, 185, 181, 0.7', fontSize: '0.90rem' }}
          >
            <em>all my homies love silence 🙊</em>
            <br />{' '}
            <span className="pl-3">
              - John Krasinski's character in <em>A Quiet Place</em>
            </span>
          </CardSubtitle>
        </CardHeader>
        <CardBody style={{ backgroundColor: 'gainsboro' }}>
          <Form>
            <div className="d-flex justify-content-between">
              <FormLabel style={{ fontSize: '1.15rem' }}>
                Noise Tolerance
              </FormLabel>
              <div style={{ width: '45%' }}>
                <FormControl
                  type="text"
                  aria-describedby="toleranceHelp"
                  onInput={(e) => setNoiseTolerance(e.target.value)}
                />
                <FormText id="toleranceHelp" style={{ fontSize: '0.76rem' }}>
                  Must be a number, <em>n</em> | 0 &lt; <em>n</em> &lt; 1, or
                  the exact cutoff in decibels, e.g., '-50dB'
                </FormText>
              </div>
            </div>
            <div className="d-flex justify-content-between mt-2">
              <FormLabel style={{ fontSize: '1.15rem' }}>
                Silence Duration
              </FormLabel>
              <div style={{ width: '45%' }}>
                <FormControl
                  type="number"
                  aria-describedby="durationHelp"
                  onInput={(e) => setSilenceduration(e.target.value)}
                />
                <FormText id="durationHelp" style={{ fontSize: '0.76rem' }}>
                  Must be a number
                </FormText>
              </div>
            </div>
            <div
              className="d-flex w-100 mt-1 gap-3"
              style={{ justifyContent: 'end' }}
            >
              <FormLabel>Multichannel scan?</FormLabel>
              <FormCheck
                type="switch"
                onChange={() => setMultichannelScan(!multichannelScan)}
              />
            </div>
          </Form>
          <div className="d-flex justify-content-between align-items-center mt-4">
            <p className="text-info pb-0 mb-0">
              <strong>File to scan: </strong>
              <em>{`${URL}`}</em>
            </p>

            <Button variant="primary" onClick={scan}>
              {loaded ? 'scan file' : 'patience plz'}
            </Button>
          </div>
        </CardBody>
      </Card>
      <AudioDropModal
        show={fileFlagged}
        setShow={setFileFlagged}
        silenceData={fileSilenceData}
      />
    </>
  );
}