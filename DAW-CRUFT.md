# DAW Cruft Analysis & Cleanup Checklist

*Generated on August 20, 2025*

This document identifies orphaned, vestigial, and redundant components within the DAW system that can be safely removed or refactored to improve codebase maintainability.

## Safe to Delete Immediately

### Orphaned Test/Debug Components
- [ ] **`components/audio/DAW/Multitrack/TrackDebug.js`**
  - **Status**: Complete orphan
  - **Justification**: Not imported anywhere in the codebase
  - **Context**: Appears to be a debugging component left over from development
  - **Risk**: None - no references found

- [ ] **`components/audio/DAW/Multitrack/SimpleWaveformTest.js`**
  - **Status**: Complete orphan
  - **Justification**: Not imported or referenced anywhere
  - **Context**: Test component with hardcoded `console.log` statements
  - **Risk**: None - clearly a development artifact

- [ ] **`components/audio/DAW/Multitrack/VirtualPiano.js`**
  - **Status**: Complete orphan
  - **Justification**: Not imported anywhere, potentially redundant with existing piano components
  - **Context**: Appears to be an alternate implementation or abandoned feature
  - **Risk**: None - no usage found

### Deprecated Effect System
- [ ] **`components/audio/DAW/Effects/index.js`**
  - **Status**: Deprecated placeholder
  - **Justification**: File contains comment "This file is kept for backward compatibility" and returns `null`
  - **Context**: Old effects system replaced by `EffectsRack.js`
  - **Risk**: None - explicitly marked as deprecated

## Investigate Before Deleting

### Legacy DAW Implementation
- [ ] **`components/audio/daw-old/dawStd.js`**
  - **Status**: Appears orphaned but needs verification
  - **Justification**: `DawStd` component not imported anywhere, but file is substantial (278 lines)
  - **Context**: Legacy single-track DAW implementation, replaced by new DAW system
  - **Risk**: Low - but verify no dynamic imports or runtime references
  - **Action**: Search for any string references to "dawStd" or "DawStd" in runtime code

- [ ] **`components/audio/daw-old/control.js`**
  - **Status**: Dependent on dawStd.js
  - **Justification**: Only imported by `dawStd.js` - if dawStd is removed, this becomes orphaned
  - **Context**: UI controls for legacy DAW implementation
  - **Risk**: Low - remove after confirming dawStd.js removal

### Potentially Unused Canvas Component
- [ ] **`components/audio/DAW/Multitrack/TrackWaveCanvas.jsx`**
  - **Status**: Not imported anywhere
  - **Justification**: No import statements found for this component
  - **Context**: Might be an alternate waveform rendering implementation
  - **Risk**: Medium - could be used dynamically or be a newer implementation
  - **Action**: Check git history and verify if this is a newer/alternate implementation

## Refactor Candidates

### Extract Dependencies from Legacy Code
- [ ] **Extract `MinimapContainer` from `daw-old/common.js`**
  - **Status**: Still needed by current DAW
  - **Justification**: Used in `components/audio/DAW/Waveform.js`
  - **Context**: Only component from old system still in use
  - **Action**: Move to its own file, update import in `Waveform.js`
  - **Risk**: Low - straightforward extraction

- [ ] **Extract `HelpModal` from `daw-old/dawHelp.js`**
  - **Status**: Still needed by current DAW
  - **Justification**: Used in `components/audio/DAW/index.js`
  - **Context**: Help system shared between old and new DAW
  - **Action**: Move to shared location like `components/common/` or `components/DAW/`
  - **Risk**: Low - clean extraction

- [ ] **Clean up remaining `daw-old/common.js`**
  - **Status**: Partially used
  - **Justification**: After extracting `MinimapContainer`, check what else is exported/used
  - **Context**: Large file (290+ lines) with multiple exports, some likely unused
  - **Action**: Remove unused exports after extracting needed components
  - **Risk**: Medium - need to verify all exports are truly unused

## Questionable Components (Need Investigation)

### Potentially Redundant Piano Components
- [ ] **`components/audio/DAW/Multitrack/PianoKeyboard.js`**
  - **Status**: Imported by MIDI components but might be redundant
  - **Justification**: Similar functionality to `VirtualPiano.js` (which is orphaned)
  - **Context**: Part of MIDI track functionality
  - **Action**: Verify this is the "correct" piano implementation vs VirtualPiano
  - **Risk**: Medium - used in MIDI system

### MIDI/Pattern System Components
- [ ] **Verify usage of Pattern system**
  - **Components**: `PatternLibrary.js`, `PatternClipRenderer.js`
  - **Status**: Used by `MIDITrack.js` but might be incomplete feature
  - **Context**: MIDI pattern/clip system that might not be fully implemented
  - **Action**: Test MIDI functionality to verify these are working features
  - **Risk**: High - could break MIDI functionality

## Impact Analysis

### Files Currently Safe to Delete
- **Count**: 4 files
- **Total LOC**: ~200-300 lines (estimated)
- **Dependencies**: None

### Files Requiring Investigation
- **Count**: 6-8 files
- **Total LOC**: ~500-800 lines (estimated)
- **Dependencies**: Some interdependent (dawStd.js → control.js)

### Cleanup Benefits
- **Code Reduction**: Potentially 700-1100 lines of dead code
- **Maintenance**: Reduced cognitive load when navigating DAW components
- **Clarity**: Cleaner import structure and component organization
- **Build Size**: Marginal reduction in bundle size

## Warnings & Considerations

1. **Runtime References**: Some components might be referenced via string lookups or dynamic imports
2. **Feature Completeness**: Some "orphaned" components might be newer implementations not yet integrated
3. **Git History**: Check component creation dates and recent commits before deletion
4. **User Impact**: Verify no user-facing features depend on questionable components
5. **Testing**: Ensure full DAW functionality testing after any removals

## Recommended Cleanup Order

1. **Phase 1**: Delete confirmed orphans (TrackDebug, SimpleWaveformTest, VirtualPiano, Effects/index.js)
2. **Phase 2**: Extract and relocate still-needed components from daw-old
3. **Phase 3**: Investigate and remove legacy DAW implementation (dawStd.js, control.js)
4. **Phase 4**: Clean up remaining daw-old files
5. **Phase 5**: Investigate questionable multitrack components

## Testing Checklist

After any deletions, verify:
- [ ] Single-track DAW functionality (waveform, effects, transport)
- [ ] Multi-track DAW functionality (track management, mixing)
- [ ] MIDI recording and playback
- [ ] Effects rack functionality
- [ ] Help system accessibility
- [ ] Audio import/export
- [ ] Project save/load (if implemented)

---

*Note: This analysis was performed via static code analysis. Dynamic usage patterns and runtime behavior should be verified before making changes.*
