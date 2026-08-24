import { Composition } from 'remotion'
import { DocumentaryComposition, DOCUMENTARY_COMP_ID, DOCUMENTARY_FPS, DOCUMENTARY_WIDTH, DOCUMENTARY_HEIGHT } from './compositions/DocumentaryComposition'

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
        defaultProps={{
          shots: [],
          beats: [],
          channelName: '',
          totalScenes: 0,
        }}
      />
    </>
  )
}
