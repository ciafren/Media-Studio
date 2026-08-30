export type MediaKind='video'|'image'|'audio';
export type Adjustments={brightness:number;contrast:number;saturation:number;temperature:number;highlights:number;shadows:number;sharpness:number;vignette:number};
export type Clip={id:string;assetId:string;kind:MediaKind;name:string;start:number;end:number;duration:number;speed:number;volume:number;muted:boolean;transition:string;adjustments:Adjustments;filter:string};
export type TextLayer={id:string;text:string;start:number;end:number;x:number;y:number;fontSize:number;color:string};
export type Asset={id:string;name:string;kind:MediaKind;blob:Blob;url:string;duration:number;createdAt:number};
export type Project={id:string;name:string;createdAt:number;updatedAt:number;clips:Clip[];texts:TextLayer[];aspect:'9:16'|'16:9'|'1:1'|'4:5'|'original'};
