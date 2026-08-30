import { useStudio } from './useStudio';import { Home } from './Home';import { Editor } from './Editor';
export default function App(){const screen=useStudio(s=>s.screen);return screen==='home'?<Home/>:<Editor/>}
