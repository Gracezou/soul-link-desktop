import { usePetStore } from '../stores/petStore'

export function useAnimation() {
  const animationName = usePetStore(s => s.animationName)
  const fvLevel = usePetStore(s => s.fvLevel)
  const setAnimation = usePetStore(s => s.setAnimation)

  return { animationName, fvLevel, setAnimation }
}
