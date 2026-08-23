/**
 * Remotion Root — entry point for Remotion bundle
 *
 * Registers the DocumentaryComposition that drives the V3 pipeline render.
 */

import { Composition } from 'remotion'
import { DocumentaryComposition, DOCUMENTARY_COMP_ID, DOCUMENTARY_FPS, DOCUMENTARY_WIDTH, DOCUMENTARY_HEIGHT } from './compositions/DocumentaryComposition'

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id={DOCUMENTARY_COMP_ID}
        component={DocumentaryComposition}
        durationInFrames={300} // placeholder — overridden by inputProps
        fps={DOCUMENTARY_FPS}
        width={DOCUMENTARY_WIDTH}
        height={DOCUMENTARY_HEIGHT}
        defaultProps={{
          edl: [],
          beats: [],
          assets: [],
          channelName: 'Money Machine',
          totalScenes: 0,
        }}
      />
    </>
  )
}
