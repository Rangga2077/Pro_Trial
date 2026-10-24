/**
 * HUD sound effects and background music. Files live in `public/sfx/` and are
 * loaded with relative URLs, so they work from the Vite dev server and from
 * the built `dist/index.html` that Electron opens.
 */

export type SfxName = 'carousel' | 'select' | 'tick' | 'transition' | 'popup' | 'timer' | 'step';

const SFX_FILES: Record<SfxName, string> = {
    carousel: 'sfx/scifi-click.mp3',
    select: 'sfx/bloob-2.mp3',
    tick: 'sfx/beeb.mp3',
    transition: 'sfx/dragon-woosh.mp3',
    popup: 'sfx/pop.mp3',
    timer: 'sfx/ui-sound.mp3',
    step: 'sfx/bloop-3.mp3',
};

/** Effects play near full volume; the music sits underneath so effects stay audible. */
const SFX_VOLUME = 0.9;
const MUSIC_VOLUME = 0.22;
/** While Jenny records a question: music nearly off, since it hurts speech recognition. */
const MUSIC_LISTENING_VOLUME = 0.04;
const MUSIC_FILE = 'sfx/bgm-happy-ukulele.mp3';

const sfxElements = new Map<SfxName, HTMLAudioElement>();
let music: HTMLAudioElement | null = null;
let musicWanted = false;
let jennyListening = false;

function element(name: SfxName): HTMLAudioElement {
    let audio = sfxElements.get(name);
    if (!audio) {
        audio = new Audio(SFX_FILES[name]);
        audio.preload = 'auto';
        audio.volume = SFX_VOLUME;
        sfxElements.set(name, audio);
    }
    return audio;
}

// Browsers (not Electron) may block audio until the first user input; retry then.
let unlockArmed = false;
function retryAfterFirstInput(): void {
    if (unlockArmed) return;
    unlockArmed = true;
    const unlock = () => {
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
        unlockArmed = false;
        if (musicWanted) void music?.play().catch(() => {});
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
}

/** Plays one effect. Rapid repeats overlap instead of cutting each other off. */
export function playSfx(name: SfxName): void {
    if (jennyListening) return; // keep effects out of Jenny's recording
    const base = element(name);
    const audio = base.paused ? base : (base.cloneNode() as HTMLAudioElement);
    audio.volume = SFX_VOLUME;
    audio.currentTime = 0;
    audio.play().catch(retryAfterFirstInput);
}

/** Starts (or keeps) the looping background music. */
export function startMusic(): void {
    musicWanted = true;
    if (!music) {
        music = new Audio(MUSIC_FILE);
        music.loop = true;
        music.volume = jennyListening ? MUSIC_LISTENING_VOLUME : MUSIC_VOLUME;
    }
    if (music.paused) music.play().catch(retryAfterFirstInput);
}

/** While Jenny records a question: music down and effects muted. */
export function setJennyListening(listening: boolean): void {
    jennyListening = listening;
    if (music) music.volume = listening ? MUSIC_LISTENING_VOLUME : MUSIC_VOLUME;
}

/** Stops the music and rewinds it for the next session. */
export function stopMusic(): void {
    musicWanted = false;
    if (!music) return;
    music.pause();
    music.currentTime = 0;
}

/** Loads the effect files up front so the first play has no delay. */
export function preloadSfx(): void {
    (Object.keys(SFX_FILES) as SfxName[]).forEach(element);
}
