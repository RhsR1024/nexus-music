import {Modal as NativeModal,type ModalProps} from 'react-native';

const orientations:NonNullable<ModalProps['supportedOrientations']>=['portrait','portrait-upside-down','landscape-left','landscape-right'];

// Keep every presentation compatible with the maintained app orientation mask.
export function Modal(props:ModalProps){return <NativeModal supportedOrientations={orientations} {...props}/>;}
export function SheetModal(props:ModalProps){return <NativeModal supportedOrientations={orientations} presentationStyle="pageSheet" {...props}/>;}
