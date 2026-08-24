import { Composition } from 'remotion'
import { DocumentaryComposition, DOCUMENTARY_COMP_ID, DOCUMENTARY_FPS, DOCUMENTARY_WIDTH, DOCUMENTARY_HEIGHT } from './compositions/DocumentaryComposition'
import { TutorialComposition, TUTORIAL_COMP_ID, TUTORIAL_FPS, TUTORIAL_WIDTH, TUTORIAL_HEIGHT } from './compositions/TutorialComposition'

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
    </>
  )
}
