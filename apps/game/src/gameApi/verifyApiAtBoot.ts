import { describeFailure, GameApiError, type GameApi } from "./GameApi.js";

export async function verifyApiAtBoot(gameApi: GameApi, exit: (code: number) => void = process.exit) {
  try {
    await gameApi.ping();
  } catch (error) {
    if (error instanceof GameApiError && error.code === "serviceTokenInvalid") {
      console.error("A API recusou o SERVICE_TOKEN: o segredo do jogo e o da API precisam ser o mesmo.", describeFailure(error));
      exit(1);
      return;
    }
    console.warn("A API não respondeu na subida; o jogo segue e tenta de novo nas próximas chamadas.", describeFailure(error));
  }
}
