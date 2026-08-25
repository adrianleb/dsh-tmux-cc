# Screenshot provenance

The screenshots in this directory are safe, synthetic project assets.

They were captured from:

- an isolated `DSH_HOME` with a fresh Web profile;
- a dedicated tmux server socket, separate from the maintainer's normal tmux server;
- a synthetic `showcase` session containing generated API, test, release, and metrics output;
- a blank demonstration workspace with no private conversations or files.

Before capture, the browser checks the expected synthetic session name, pane count, responsive layout, and absence of horizontal overflow. On desktop it verifies that every horizontal and vertical pane seam has a zero-pixel gap, all outer pane edges match the cockpit body, and toolbar control centers remain aligned. At a 390×844 CSS viewport it repeats the zero-gap seam checks, verifies that all four panes remain visible in the real tmux grid, focuses the bottom-right Metrics pane, toggles native tmux zoom, checks that the one visible pane exactly matches the cockpit body, unzooms back to four panes, and confirms that the 768px boundary restores desktop behavior.
