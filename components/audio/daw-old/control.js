'use client';

import { Button, Card, CardHeader, CardTitle, CardBody, Form } from 'react-bootstrap';

// SEEME @mfwolffe idk if I want to elevate state here actually
const EQSliders = ({ hide, filters, width }) => {
  const hidden = hide;
  const sliders = [];

  filters.forEach((filter, i) => {
    const frqVal = filter.frequency.value;
    const slider = (
        <div className="d-flex" key={`${frqVal} MHz`}>
          <Form.Label style={{ width: '40%' }}>{frqVal} MHz</Form.Label>
          <Form.Range
            min={-26}
            max={26}
            step={0.1}
            style={{ width: '60%' }}
            onInput={(e) => (filter.gain.value = e.target.value)}
          ></Form.Range>
        </div>
    );

    sliders.push(slider);
  });

  return (
    <>
      <Card id="equalizer" hidden={hidden} style={{ width: `${width}%` }}>
        <CardHeader className="text-center text-white pt-1 pb-1 bg-daw-toolbars">
          <CardTitle className="pt-0 pb-0 mt-0 mb-0">Equalizer</CardTitle>
        </CardHeader>
        <CardBody className="bg-dawcontrol text-white mlr-a plr-0 pt-2 pb-2 w-100">
          <div className="flex-even gap-2 mlr-a w-100 plr-1">
            <div>{sliders.slice(0, 5)}</div>
            <div>{sliders.slice(5, 10)}</div>
          </div>
        </CardBody>
      </Card>
    </>
  );
};


const SliderGroup = ({ slider1, slider2, showGain }) => {
  return (
    <div className="mb-0 pb-0">
      <div className="d-flex gap-025">
        {slider1}
        {slider2 ?? ''}
      </div>
      {showGain && (
        <p className="text-center mt-0 mb-0">
          <strong>Gain</strong>
        </p>
      )}
    </div>
  );
};

const ReverbChorusWidget = ({
  hide,
  width,
  sliders,
  handler,
  title,
  hasButton,
  ffmpegRef,
  inGainChr,
  outGainChr,
  delayChr,
  decayChr,
  speedChr,
  depthsChr,
  audioRef,
  setAudioURL,
  audioURL,
  wavesurfer,
  setEditList,
  editList,
  setEditListIndex,
  editListIndex,
}) => {
  const hidden = hide;
  const sliderGroups = [];

  for (let i = 0; i < sliders.length; i += 2) {
    sliderGroups.push(
      <SliderGroup
        key={`slider-${i}`}
        slider1={sliders[i]}
        slider2={i + 1 < sliders.length ? sliders[i + 1] : null}
        showGain={i < 1 ? true : false}
      />
    );
  }

  return (
    <Card
      id={`${title.toLowerCase()}`}
      hidden={hidden}
      style={{ width: `${width}%` }}
    >
      <CardHeader className="text-center text-white pt-1 pb-1 bg-daw-toolbars">
        <CardTitle className="pt-0 pb-0 mt-0 mb-0">{title}</CardTitle>
      </CardHeader>
      <CardBody className="bg-dawcontrol text-white plr-0 pt-2 pb-0 w-100">
        <div className="flex-even gap-0 mlr-a w-100 plr-0">{sliderGroups}</div>
        {hasButton && (
          <div className="d-flex justify-content-end">
            <Button
              size="sm"
              className="mb-0 mr-2 mt-1"
              onClick={() =>
                handler(
                  ffmpegRef,
                  inGainChr,
                  outGainChr,
                  delayChr,
                  decayChr,
                  speedChr,
                  depthsChr,
                  audioRef,
                  setAudioURL,
                  audioURL,
                  wavesurfer,
                  setEditList,
                  editList,
                  setEditListIndex,
                  editListIndex
                )
              }
            >
              Apply
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
};

const WidgetSlider = (min, max, step, dfault, setter, label) => {
  return (
    <div>
      <input
        min={min}
        max={max}
        step={step}
        type="range"
        orient="vertical"
        className="mlr-auto"
        // defaultValue={dfault}
        {...(dfault === null && { defaultValue: dfault })}
        onInput={(e) => setter(e.target.value)}
      ></input>
      <Form.Label className="d-block text-center mb-0">{label}</Form.Label>
    </div>
  );
};

export { ReverbChorusWidget, EQSliders, WidgetSlider };
