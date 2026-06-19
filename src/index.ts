import { router } from "@kairo-js/router";
import { properties } from "./properties";

router.init(properties);

router.beforeEvents.startup.subscribe((_ev) => {
    // API・イベント・コマンドの登録はここに追加していく
});
