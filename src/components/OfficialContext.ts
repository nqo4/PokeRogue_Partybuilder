import { createContext, useContext } from "react";
import type { Official } from "../lib/official";

/** 공식 게임 데이터 (진화·바이옴·트레이너). 파일이 없으면 null */
export const OfficialContext = createContext<Official | null>(null);
export const useOfficial = () => useContext(OfficialContext);
