import { DialogBase } from "../DialogBase";
import { ButtonBar } from "../widget/ButtonBar";
import { Button } from "../widget/Button";
import { TextContent } from "../widget/TextContent";
import { Form } from "../widget/Form";
import { Singletons } from "../Singletons";
import { Constants as C} from "../Constants";
import { PubSub } from "../PubSub";
import { VideoPlayer } from "../widget/VideoPlayer";
import { AppState } from "../AppState";
import { CompIntf } from "../widget/base/CompIntf";

let S : Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

/**
 * See also: AudioPlayerDlg (which is very similar)
 */
export class VideoPlayerDlg extends DialogBase {

    videoPlayer: VideoPlayer;

    constructor(private sourceUrl: string, private mediaTitle: string, state: AppState) {
        super(mediaTitle ? mediaTitle : "Video", null, false, false, state);
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                //space is at a premium for mobile, so let's just not even show the header.
                this.mediaTitle ? new TextContent(this.mediaTitle) : null,
                this.videoPlayer = new VideoPlayer({
                    "src": this.sourceUrl,
                    style: {
                        width: "100%",
                        border: "3px solid gray",
                        padding: "0px",
                        marginTop: "0px",
                        marginLeft: "0px",
                        marginRight: "0px"
                    },
                    //"ontimeupdate": () => { S.podcast.onTimeUpdate(this); },
                    //"oncanplay": () => { S.podcast.onCanPlay(this); },
                    "controls": "controls",
                    "autoPlay": "autoplay",
                    //"muted" : "false",
                    //"volume": "0.9",
                    //"preload": "auto"
                }),
                new ButtonBar([
                    //todo-1: even if this button appears to work, I need it to explicitly enforce the saving of the time value AND the removal of the VIDEO element from the DOM */
                    new Button("Close", () => {
                        this.close();
                    })
                ])
            ])
        ];
    }

    getVideoElement(): HTMLVideoElement {
        return this.videoPlayer.getVideoElement();
    }

    superClose = this.close;

    /* When the dialog closes we need to stop and remove the player */
    close = (): void => {
        console.log("VideoPlayerDialog cancel()");
        //todo-1: need to check over, and document flow of this functiuon as it relates to calling "podcast.destroyPlayer(this);"
        this.destroyPlayer();
        this.superClose();
    }

    closeEvent = (): void => {
        this.destroyPlayer();
    }

    destroyPlayer = (): void => {
        let player = this.videoPlayer ? this.videoPlayer.getVideoElement() : null;
        if (player) {
            player.pause();
            player.remove();
            this.videoPlayer = null;
            this.close();
        }
    }

    init = (): void => {
        // this.videoPlayer.whenElm((elm: HTMLElement) => {
        //     //S.podcast.player = elm;
        // });
    }
}
