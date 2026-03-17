# Requirements Document

## Introduction

Flappy Kiro is a retro browser-based endless scroller game. The player guides a ghost character ("Ghosty") through a series of pipe obstacles by tapping, clicking, or pressing spacebar to flap upward while gravity pulls the character down. The game features a hand-drawn/sketchy visual aesthetic, sound effects, and a persistent high score. The game runs entirely in the browser with no server-side dependencies.

## Glossary

- **Game**: The Flappy Kiro browser application
- **Ghosty**: The ghost character sprite controlled by the player, rendered using `assets/ghosty.png`
- **Pipe**: A green, hand-drawn-style vertical obstacle pair (top and bottom) with a gap that scrolls from right to left
- **Gap**: The vertical opening between the top and bottom pipe through which Ghosty must pass
- **Cloud**: A floating white rounded-rectangle obstacle that scrolls from right to left
- **Score**: The count of pipe pairs successfully passed by Ghosty in the current session
- **High Score**: The highest Score achieved across all sessions, persisted in browser local storage
- **Canvas**: The HTML5 `<canvas>` element on which the game is rendered
- **Gravity**: The constant downward acceleration applied to Ghosty each frame
- **Flap**: The upward velocity impulse applied to Ghosty when the player inputs a jump action
- **Collision**: Contact between Ghosty's hitbox and a Pipe, Cloud, or screen boundary
- **Menu**: The main menu state displayed on game load, showing the game title, High Score, and a prompt to start
- **Idle**: The initial state before the first input, where Ghosty bobs in place and no obstacles move
- **Playing**: The active game state where obstacles scroll and score accumulates
- **Paused**: The state entered when the player pauses during Playing, where all movement freezes and a "Paused" overlay is shown
- **Game Over**: The state entered when a Collision occurs
- **Renderer**: The component responsible for drawing all game elements to the Canvas each frame
- **Physics_Engine**: The component responsible for updating Ghosty's position and velocity each frame
- **Input_Handler**: The component responsible for capturing player input events
- **Collision_Detector**: The component responsible for detecting Collisions between Ghosty and obstacles or boundaries
- **Score_Manager**: The component responsible for tracking Score and High Score
- **Audio_Manager**: The component responsible for playing sound effects and background music
- **Particle_Trail**: A short-lived visual effect emitted from Ghosty's position as she moves
- **Screen_Shake**: A brief camera-shake effect applied to the Canvas on collision
- **Score_Popup**: A transient visual indicator (e.g. "+1") that appears near a pipe when the score increments
- **Background_Music**: Looping ambient audio played during the Playing state

---

## Requirements

### Requirement 1: Game Initialization and Main Menu

**User Story:** As a player, I want the game to load and display a main menu immediately in my browser, so that I can see my high score and start playing without any setup.

#### Acceptance Criteria

1. THE Game SHALL render on an HTML5 Canvas element sized to fit the browser viewport on load.
2. THE Score_Manager SHALL load the High Score from browser local storage on initialization, before the Menu state is rendered.
3. WHEN the Game initializes, THE Game SHALL enter the Menu state and display the game title "Flappy Kiro", the current High Score in the format "Best: X", and a "Tap or press Space to start" prompt.
4. THE Renderer SHALL draw the light-blue sketchy background on every frame.
5. WHEN the player triggers a Flap action during the Menu state, THE Game SHALL transition to the Idle state and display Ghosty centered horizontally at 25% of the Canvas width and vertically centered.
6. THE Game SHALL display a "Tap or press Space to start" prompt to the player during the Idle state.

---

### Requirement 2: Player Input and Flap Mechanic

**User Story:** As a player, I want to control Ghosty by tapping, clicking, or pressing spacebar, so that I can navigate through obstacles.

#### Acceptance Criteria

1. WHEN the player presses the spacebar, THE Input_Handler SHALL trigger a Flap action.
2. WHEN the player clicks or taps the Canvas, THE Input_Handler SHALL trigger a Flap action.
3. WHEN a Flap action is triggered during the Idle state, THE Game SHALL transition to the Playing state.
4. WHEN a Flap action is triggered during the Playing state, THE Physics_Engine SHALL apply an upward velocity impulse to Ghosty.
5. WHEN a Flap action is triggered, THE Audio_Manager SHALL play `assets/jump.wav`.
6. WHEN a Flap action is triggered during the Game Over state, THE Game SHALL reset and transition to the Menu state.

---

### Requirement 2a: Pause Functionality

**User Story:** As a player, I want to pause the game during play, so that I can take a break without losing my current run.

#### Acceptance Criteria

1. WHEN the player presses the Escape or P key during the Playing state, THE Game SHALL transition to the Paused state.
2. WHILE the Game is in the Paused state, THE Physics_Engine SHALL halt all positional updates for Ghosty and all obstacles.
3. WHILE the Game is in the Paused state, THE Renderer SHALL display a semi-transparent "Paused" overlay centered on the Canvas.
4. WHEN the player presses the Escape or P key during the Paused state, THE Game SHALL transition back to the Playing state and resume all movement from the frozen positions.
5. WHILE the Game is in the Paused state, THE Input_Handler SHALL ignore Flap actions so that unpausing does not also trigger a Flap.

---

### Requirement 3: Physics and Gravity

**User Story:** As a player, I want Ghosty to fall naturally under gravity and rise when I flap, so that the game feels responsive and challenging.

#### Acceptance Criteria

1. WHILE the Game is in the Playing state, THE Physics_Engine SHALL apply a gravity constant of 0.5 pixels per frame squared as a downward acceleration to Ghosty's vertical velocity on each frame.
2. WHEN a Flap action is triggered, THE Physics_Engine SHALL set Ghosty's vertical velocity to -8 pixels per frame (upward), overriding any current vertical velocity.
3. THE Physics_Engine SHALL update Ghosty's vertical position each frame by adding the current vertical velocity to the current vertical position.
4. THE Physics_Engine SHALL cap Ghosty's maximum downward vertical velocity at 12 pixels per frame (terminal velocity), preventing further acceleration beyond this value.
5. WHILE the Game is in the Playing state and no Flap action has occurred on the current frame, THE Physics_Engine SHALL carry the existing vertical velocity forward into the next frame without resetting it, preserving momentum between frames.
6. THE Physics_Engine SHALL compute Ghosty's positional update using delta-time scaling, multiplying velocity and acceleration values by the elapsed time in milliseconds divided by a reference frame duration of 16.67ms, so that movement remains consistent across varying frame rates.

---

### Requirement 4: Pipe Obstacles

**User Story:** As a player, I want pipes to scroll toward me continuously, so that I have a constant challenge to navigate.

#### Acceptance Criteria

1. WHILE the Game is in the Playing state, THE Game SHALL spawn a new Pipe pair at the right edge of the Canvas at a fixed time interval.
2. WHILE the Game is in the Playing state, THE Renderer SHALL draw each Pipe pair scrolling from right to left at a constant speed.
3. THE Renderer SHALL draw Pipes with a green, hand-drawn/sketchy visual style.
4. WHEN a Pipe pair scrolls fully off the left edge of the Canvas, THE Game SHALL remove it from the active obstacle list.
5. THE Game SHALL randomize the vertical position of the Gap for each new Pipe pair within safe bounds that keep the Gap fully within the Canvas.
6. THE Gap SHALL have a fixed height sufficient to allow Ghosty to pass through with skill.

---

### Requirement 5: Cloud Obstacles

**User Story:** As a player, I want floating cloud obstacles in addition to pipes, so that the game has additional visual variety and challenge.

#### Acceptance Criteria

1. WHILE the Game is in the Playing state, THE Game SHALL spawn Cloud obstacles at the right edge of the Canvas at randomized intervals.
2. WHILE the Game is in the Playing state, THE Renderer SHALL draw each Cloud scrolling from right to left at a constant speed.
3. THE Renderer SHALL draw Clouds as white rounded rectangles consistent with the hand-drawn aesthetic.
4. WHEN a Cloud scrolls fully off the left edge of the Canvas, THE Game SHALL remove it from the active obstacle list.
5. WHEN Ghosty's hitbox overlaps a Cloud, THE Collision_Detector SHALL register a Collision.

---

### Requirement 6: Collision Detection and Game Over

**User Story:** As a player, I want the game to end when I hit an obstacle or boundary, so that there are clear consequences for mistakes.

#### Acceptance Criteria

1. WHEN Ghosty's hitbox overlaps any Pipe, THE Collision_Detector SHALL register a Collision.
2. WHEN Ghosty's vertical position causes the hitbox to reach the top or bottom boundary of the Canvas, THE Collision_Detector SHALL register a Collision.
3. WHEN a Collision is registered, THE Game SHALL transition to the Game Over state.
4. WHEN the Game transitions to the Game Over state, THE Audio_Manager SHALL play `assets/game_over.wav`.
5. WHEN the Game transitions to the Game Over state, THE Renderer SHALL display a "Game Over" overlay showing the final Score in the format "Score: X", the High Score in the format "Best: X", and a "Tap or press Space to restart" prompt.
6. WHEN the Game transitions to the Game Over state, THE Score_Manager SHALL compare the current Score to the High Score and update the High Score if the current Score is greater.
7. WHEN the High Score is updated on Game Over, THE Score_Manager SHALL persist the new High Score to browser local storage immediately.

---

### Requirement 7: Scoring

**User Story:** As a player, I want to see my current score update in real time and have my all-time high score persist, so that I have a goal to beat.

#### Acceptance Criteria

1. WHEN Ghosty passes the right edge of a Pipe pair completely, THE Score_Manager SHALL increment the Score by 1.
2. WHEN the Score is incremented, THE Score_Manager SHALL immediately compare the new Score to the High Score and persist the High Score to browser local storage if the new Score is greater.
3. WHILE the Game is in the Playing state, THE Renderer SHALL display the current Score and High Score on a dark bar at the bottom of the Canvas in the format "Score: X | Best: X", updating on every frame.
4. WHEN the Game resets after Game Over, THE Score_Manager SHALL reset the current Score to 0.
5. THE High Score SHALL persist across browser sessions via browser local storage.

---

### Requirement 8: Visual Aesthetic

**User Story:** As a player, I want the game to have a retro hand-drawn look, so that it feels charming and distinctive.

#### Acceptance Criteria

1. THE Renderer SHALL draw the background as a light-blue color with a sketchy/hand-drawn style on every frame.
2. THE Renderer SHALL render Ghosty using the sprite at `assets/ghosty.png`.
3. THE Renderer SHALL draw all Pipes with a green color and sketchy outline style.
4. THE Renderer SHALL draw all Clouds as white rounded rectangles with a sketchy outline style.
5. THE Renderer SHALL use a retro or pixel-style font for all on-screen text.

---

### Requirement 9: Audio

**User Story:** As a player, I want sound effects and background music for key game events, so that the game feels more engaging and immersive.

#### Acceptance Criteria

1. WHEN a Flap action occurs, THE Audio_Manager SHALL play the audio file at `assets/jump.wav`.
2. WHEN Ghosty passes a Pipe pair and the Score is incremented, THE Audio_Manager SHALL play a distinct score sound effect separate from the flap sound.
3. WHEN a Collision is registered, THE Audio_Manager SHALL play the audio file at `assets/game_over.wav`.
4. WHEN the Game transitions to the Playing state, THE Audio_Manager SHALL begin playing Background_Music as a looping tone generated via the Web Audio API (e.g. a simple oscillator-based melody), requiring no external audio asset file.
5. WHILE the Game is in the Paused state, THE Audio_Manager SHALL pause the Background_Music playback.
6. WHEN the Game transitions to the Game Over state, THE Audio_Manager SHALL stop the Background_Music playback.
7. WHEN the Game transitions back to the Playing state from Paused, THE Audio_Manager SHALL resume Background_Music playback from where it was paused.
8. THE Audio_Manager SHALL not play any sound or start the Background_Music if the browser has not yet received a user interaction gesture (to comply with browser autoplay policies).

---

### Requirement 11: Visual Feedback Effects

**User Story:** As a player, I want visual feedback effects on key game events, so that collisions, movement, and scoring feel satisfying and readable.

#### Acceptance Criteria

1. WHEN a Collision is registered, THE Renderer SHALL apply a Screen_Shake effect to the Canvas by applying a random positional offset of up to 5 pixels in both the horizontal and vertical axes on each frame for a duration of 300ms, then returning the Canvas to its original position.
2. WHILE the Game is in the Playing state, THE Renderer SHALL emit Particle_Trail sprites from Ghosty's tail position on each frame, where each particle is a small semi-transparent white circle that fades from full opacity to zero over 500ms before being removed.
3. WHEN the Score is incremented, THE Renderer SHALL display a Score_Popup showing the text "+1" at the horizontal position of the pipe pair that was just passed and at the vertical center of the Gap, floating upward by 30 pixels and fading from full opacity to zero over 600ms before being removed.
4. WHILE the Game is in the Playing state, THE Renderer SHALL update all active Particle_Trail and Score_Popup elements each frame, advancing their age and removing any whose lifetime has expired.

---

### Requirement 10: Browser Compatibility and Self-Containment

**User Story:** As a player, I want to open the game directly in a browser without installing anything, so that it's easy to access and share.

#### Acceptance Criteria

1. THE Game SHALL be implemented as a single HTML file with all CSS and JavaScript inline or in sibling files loadable without a build step.
2. THE Game SHALL run correctly in current versions of Chrome, Firefox, and Safari without plugins.
3. THE Game SHALL reference asset files using relative paths (`assets/ghosty.png`, `assets/jump.wav`, `assets/game_over.wav`).
4. THE Game SHALL function correctly when opened via the `file://` protocol or a local HTTP server.
