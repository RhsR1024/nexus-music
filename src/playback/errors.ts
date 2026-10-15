// Only application-authored messages opt into the player UI. Raw script/server
// errors stay hidden because they can contain credentials or signed URLs.
export class PlaybackMessageError extends Error {
  readonly displayMessage:string;
  constructor(message:string){super(message);this.displayMessage=message;}
}
