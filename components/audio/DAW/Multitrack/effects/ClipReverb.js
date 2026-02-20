/**
 * ClipReverb - Clip-based version of Reverb effect
 * Adapted from single-track Reverb for use with multitrack clip effects
 *
 * Props:
 * - parameters: Object containing all effect parameters
 * - onParametersChange: Callback function to update parameters
 */

'use client';

import { useEffect, useState } from 'react';
import { Container, Row, Col, Form, Dropdown, OverlayTrigger, Tooltip } from 'react-bootstrap';
import Knob from '../../../../Knob';
import { getPresetNames, impulseResponsePresets } from '../../../../../lib/impulseResponses';

/**
 * Educational Tooltips
 */
const ReverbTooltips = {
  preset: "Choose from various space simulations. Small rooms for tight ambience, halls for grandeur, plates for vintage smoothness, chambers for natural space.",
  mix: "Balance between dry (original) and wet (reverb) signal. Lower values (10-30%) add subtle space, higher values (50-80%) create atmospheric effects.",
  preDelay: "Time before reverb begins. Simulates distance to reflective surfaces. 10-30ms adds clarity, 50-100ms creates depth, 100ms+ for special effects.",
  hiDamp: "Reduces high frequencies in reverb tail. Simulates air absorption. Higher values create darker, more natural reverb similar to real spaces.",
  loDamp: "Reduces low frequencies in reverb tail. Prevents muddiness. Use to tighten bass-heavy material or create clearer reverb.",
  earlyLate: "Balance between early reflections (clarity) and late reverb (ambience). Lower values emphasize room character, higher values emphasize spaciousness.",
  width: "Stereo spread of reverb. 100% is natural stereo, lower values narrow the image, higher values enhance width. Use with caution above 150%.",
  output: "Overall reverb output level. Use to match reverb level with dry signal. Values above 1.0x boost the effect, useful for ambient textures."
};

/**
 * Reverb effect component - Clip-based version
 */
export default function ClipReverb({ parameters, onParametersChange }) {
  // Initialize all parameters from props
  const [preset, setPreset] = useState(parameters?.preset ?? 'mediumHall');
  const [wetMix, setWetMix] = useState(parameters?.wetMix ?? 0.3);
  const [preDelay, setPreDelay] = useState(parameters?.preDelay ?? 0);
  const [outputGain, setOutputGain] = useState(parameters?.outputGain ?? 1);
  const [highDamp, setHighDamp] = useState(parameters?.highDamp ?? 0.5);
  const [lowDamp, setLowDamp] = useState(parameters?.lowDamp ?? 0.1);
  const [stereoWidth, setStereoWidth] = useState(parameters?.stereoWidth ?? 1);
  const [earlyLate, setEarlyLate] = useState(parameters?.earlyLate ?? 0.5);

  // Sync with parent on parameter changes
  useEffect(() => {
    onParametersChange({
      preset,
      wetMix,
      preDelay,
      outputGain,
      highDamp,
      lowDamp,
      stereoWidth,
      earlyLate
    });
  }, [preset, wetMix, preDelay, outputGain, highDamp, lowDamp, stereoWidth, earlyLate, onParametersChange]);

  // Update preset and apply preset parameters to knobs
  useEffect(() => {
    if (preset && impulseResponsePresets[preset]) {
      const presetData = impulseResponsePresets[preset];
      if (presetData.parameters) {
        setWetMix(presetData.parameters.wetMix);
        setPreDelay(presetData.parameters.preDelay);
        setHighDamp(presetData.parameters.highDamp);
        setLowDamp(presetData.parameters.lowDamp);
        setEarlyLate(presetData.parameters.earlyLate);
        setStereoWidth(presetData.parameters.stereoWidth);
        setOutputGain(presetData.parameters.outputGain);
      }
    }
  }, [preset]);

  const presetNames = getPresetNames();

  return (
    <Container fluid className="p-2">
      <Row className="text-center align-items-end">
        {/* Preset Selector */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Form.Label className="text-white small mb-1">Preset</Form.Label>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{ReverbTooltips.preset}</Tooltip>}
          >
            <Dropdown
              onSelect={(eventKey) => setPreset(eventKey)}
              size="sm"
            >
              <Dropdown.Toggle
                variant="secondary"
                size="sm"
                className="w-100"
              >
                {impulseResponsePresets[preset]?.name || 'Select Preset'}
              </Dropdown.Toggle>
              <Dropdown.Menu className="bg-dark">
                {presetNames.map(key => (
                  <Dropdown.Item
                    key={key}
                    eventKey={key}
                    className="text-white"
                  >
                    {impulseResponsePresets[key].name}
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown>
          </OverlayTrigger>
        </Col>

        {/* Mix */}
        <Col xs={6} sm={4} md={2} lg={1}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{ReverbTooltips.mix}</Tooltip>}
          >
            <div>
              <Knob
                value={wetMix}
                onChange={setWetMix}
                min={0}
                max={1}
                label="Mix"
                displayValue={`${Math.round(wetMix * 100)}%`}
                size={45}
                color="#92ce84"
              />
            </div>
          </OverlayTrigger>
        </Col>

        {/* Pre-Delay */}
        <Col xs={6} sm={4} md={2} lg={1}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{ReverbTooltips.preDelay}</Tooltip>}
          >
            <div>
              <Knob
                value={preDelay}
                onChange={setPreDelay}
                min={0}
                max={200}
                step={1}
                label="Pre-Dly"
                displayValue={`${preDelay}ms`}
                size={45}
                color="#7bafd4"
              />
            </div>
          </OverlayTrigger>
        </Col>

        {/* High Damping */}
        <Col xs={6} sm={4} md={2} lg={1}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{ReverbTooltips.hiDamp}</Tooltip>}
          >
            <div>
              <Knob
                value={highDamp}
                onChange={setHighDamp}
                min={0}
                max={1}
                label="Hi Damp"
                displayValue={`${Math.round(highDamp * 100)}%`}
                size={45}
                color="#cbb677"
              />
            </div>
          </OverlayTrigger>
        </Col>

        {/* Low Damping */}
        <Col xs={6} sm={4} md={2} lg={1}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{ReverbTooltips.loDamp}</Tooltip>}
          >
            <div>
              <Knob
                value={lowDamp}
                onChange={setLowDamp}
                min={0}
                max={1}
                label="Lo Damp"
                displayValue={`${Math.round(lowDamp * 100)}%`}
                size={45}
                color="#cbb677"
              />
            </div>
          </OverlayTrigger>
        </Col>

        {/* Early/Late Mix */}
        <Col xs={6} sm={4} md={2} lg={1}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{ReverbTooltips.earlyLate}</Tooltip>}
          >
            <div>
              <Knob
                value={earlyLate}
                onChange={setEarlyLate}
                min={0}
                max={1}
                label="E/L Mix"
                displayValue={`${Math.round(earlyLate * 100)}%`}
                size={45}
                color="#92ceaa"
              />
            </div>
          </OverlayTrigger>
        </Col>

        {/* Stereo Width */}
        <Col xs={6} sm={4} md={2} lg={1}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{ReverbTooltips.width}</Tooltip>}
          >
            <div>
              <Knob
                value={stereoWidth}
                onChange={setStereoWidth}
                min={0}
                max={2}
                label="Width"
                displayValue={`${Math.round(stereoWidth * 100)}%`}
                size={45}
                color="#e75b5c"
              />
            </div>
          </OverlayTrigger>
        </Col>

        {/* Output Gain */}
        <Col xs={6} sm={4} md={2} lg={1}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{ReverbTooltips.output}</Tooltip>}
          >
            <div>
              <Knob
                value={outputGain}
                onChange={setOutputGain}
                min={0}
                max={2}
                label="Output"
                displayValue={`${outputGain.toFixed(1)}x`}
                size={45}
                color="#92ceaa"
              />
            </div>
          </OverlayTrigger>
        </Col>
      </Row>
    </Container>
  );
}
