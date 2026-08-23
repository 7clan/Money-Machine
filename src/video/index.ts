/**
 * Remotion entry point — registers the Root composition
 *
 * This is the file that @remotion/bundler bundles. It must `registerRoot`
 * with the RemotionRoot component.
 */

import { registerRoot } from 'remotion'
import { RemotionRoot } from './Root'

registerRoot(RemotionRoot)
