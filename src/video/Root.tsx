import { Composition } from 'remotion'
import { DocumentaryComposition, DOCUMENTARY_COMP_ID, DOCUMENTARY_FPS, DOCUMENTARY_WIDTH, DOCUMENTARY_HEIGHT } from './compositions/DocumentaryComposition'
import { TutorialComposition, TUTORIAL_COMP_ID, TUTORIAL_FPS, TUTORIAL_WIDTH, TUTORIAL_HEIGHT } from './compositions/TutorialComposition'
import {
  AnimatedSceneProof,
  ANIMATION_PROOF_COMP_ID,
  ANIMATION_PROOF_DURATION,
  ANIMATION_PROOF_FPS,
  ANIMATION_PROOF_HEIGHT,
  ANIMATION_PROOF_WIDTH,
} from './compositions/AnimatedSceneProof'
import {
  AnimatedPilotComposition,
  PILOT_COMP_ID,
  PILOT_DURATION,
  PILOT_FPS,
  PILOT_HEIGHT,
  PILOT_WIDTH,
} from './compositions/AnimatedPilotComposition'

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id={DOCUMENTARY_COMP_ID}
        component={DocumentaryComposition}
        durationInFrames={300}
        fps={DOCUMENTARY_FPS}
        width={DOCUMENTARY_WIDTH}
        height={DOCUMENTARY_HEIGHT}
        defaultProps={{ shots: [], beats: [], channelName: '', totalScenes: 0 }}
      />
      <Composition
        id={TUTORIAL_COMP_ID}
        component={TutorialComposition}
        durationInFrames={300}
        fps={TUTORIAL_FPS}
        width={TUTORIAL_WIDTH}
        height={TUTORIAL_HEIGHT}
        defaultProps={{ shots: [], segments: [], channelName: '', totalScenes: 0 }}
      />
      <Composition
        id={ANIMATION_PROOF_COMP_ID}
        component={AnimatedSceneProof}
        durationInFrames={ANIMATION_PROOF_DURATION}
        fps={ANIMATION_PROOF_FPS}
        width={ANIMATION_PROOF_WIDTH}
        height={ANIMATION_PROOF_HEIGHT}
        defaultProps={{ backgroundPath: 'test-d/scene-01.png' }}
      />
      <Composition
        id={PILOT_COMP_ID}
        component={AnimatedPilotComposition}
        durationInFrames={PILOT_DURATION}
        fps={PILOT_FPS}
        width={PILOT_WIDTH}
        height={PILOT_HEIGHT}
        defaultProps={{}}
      />
    </>
  )
}
