async function updateTheme() {
	const THEME_SUPPORT = {
		AUTO: eagle.app.isDarkColors() ? "gray" : "light",
		LIGHT: "light",
		LIGHTGRAY: "lightgray",
		GRAY: "gray",
		DARK: "dark",
		BLUE: "blue",
		PURPLE: "purple",
	};

	const theme = eagle.app.theme.toUpperCase();
	const themeName = THEME_SUPPORT[theme] ?? "dark";
	const htmlEl = document.querySelector("html");

	htmlEl.classList.add("no-transition");
	htmlEl.setAttribute("theme", themeName);
	htmlEl.setAttribute("platform", eagle.app.platform);
	htmlEl.classList.remove("no-transition");
}

eagle.onPluginCreate(async () => {
	console.log("eagle.onPluginCreate");
	await updateTheme();
});

eagle.onThemeChanged(async () => {
	console.log("eagle.onThemeChanged");
	await updateTheme();
});

eagle.onPluginRun(() => {
	console.log("eagle.onPluginRun");
});

eagle.onPluginShow(() => {
	console.log("eagle.onPluginShow");

});

eagle.onPluginHide(() => {
	console.log("eagle.onPluginHide");
});

eagle.onPluginBeforeExit((event) => {
	console.log("eagle.onPluginBeforeExit");
});

