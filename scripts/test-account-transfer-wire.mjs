import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createCipheriv,createHmac} from 'node:crypto';
const root=resolve('build/tests/account-transfer-wire');mkdirSync(root,{recursive:true});
const source=readFileSync('modules/nexus-native/ios/NexusMusicAuthModule.swift','utf8');
const begin=source.indexOf('// MARK: Account transfer wire'),end=source.indexOf('private final class AccountTransferRequest',begin);
if(begin<0||end<begin)throw Error('Missing production wire policy');
const key='11'.repeat(32),id='22'.repeat(16),nonce='33'.repeat(16),iv=Buffer.alloc(12,0x44);
const link=`qmusic://account-transfer?v=1&host=192.168.1.2&port=18080&id=${id}&key=${key}`;
const payload=JSON.stringify({v:1,provider:'tx',expiresAt:100001,cookies:{qqmusic_key:'W_X-unit-only',qqmusic_uin:'42',wxuin:'42',login_type:'2'}});
const cipher=createCipheriv('aes-256-gcm',Buffer.from(key,'hex'),iv);cipher.setAAD(Buffer.from(`${id}:${nonce}`));
const encrypted=Buffer.concat([cipher.update(payload),cipher.final(),cipher.getAuthTag()]);
writeFileSync(root+'/fixture.json',JSON.stringify({link,nonce,proof:createHmac('sha256',Buffer.from(key,'hex')).update(`claim:${id}:${nonce}`).digest('hex'),payload,envelope:JSON.stringify({iv:iv.toString('base64'),data:encrypted.toString('base64')})}));
const checks=String.raw`
let fixture=try JSONSerialization.jsonObject(with:Data(contentsOf:URL(fileURLWithPath:CommandLine.arguments[1]))) as! [String:String]
let wire=try AccountTransferWire(fixture["link"]!)
let (request,nonce)=try wire.request(nonce:Data(repeating:0x33,count:16))
precondition(nonce==fixture["nonce"] && request.httpMethod=="POST" && !request.httpShouldHandleCookies)
let body=try JSONSerialization.jsonObject(with:request.httpBody!) as! [String:String]
precondition(body.count==2 && body["nonce"]==nonce && body["proof"]==fixture["proof"])
precondition(request.url!.absoluteString=="http://192.168.1.2:18080/qmusic-account-transfer/"+wire.id)
let envelope=Data(fixture["envelope"]!.utf8)
let plain=try wire.open(envelope,nonce:nonce,now:1);precondition(plain==fixture["payload"])
func rejects(_ f:()throws->Void){var rejected=false;do{try f()}catch{rejected=true};precondition(rejected)}
for host in ["127.0.0.1","169.254.0.1","0.0.0.0","8.8.8.8","example.com","192.168.01.2","192.168.1.256","172.32.1.1","10.1.1.1.","::1"]{precondition(!AccountTransferWire.privateIPv4(host));rejects{_ = try AccountTransferWire(fixture["link"]!.replacingOccurrences(of:"192.168.1.2",with:host))}}
for host in ["10.0.0.1","172.16.0.1","172.31.255.254","192.168.1.2"]{precondition(AccountTransferWire.privateIPv4(host))}
for suffix in ["&v=1","&key="+String(repeating:"0",count:64),"#secret"]{rejects{_ = try AccountTransferWire(fixture["link"]!+suffix)}}
for bad in [fixture["link"]!.replacingOccurrences(of:"port=18080",with:"port=80"),fixture["link"]!.replacingOccurrences(of:"port=18080",with:"port=018080"),fixture["link"]!.replacingOccurrences(of:"account-transfer?",with:"account-transfer/path?"),String(repeating:"x",count:1025)]{rejects{_ = try AccountTransferWire(bad)}}
rejects{_ = try wire.open(envelope,nonce:String(repeating:"0",count:32),now:1)}
rejects{_ = try wire.open(envelope,nonce:nonce,now:100001)}
rejects{_ = try wire.open(envelope,nonce:nonce,now:-100000)}
rejects{_ = try wire.open(Data(repeating:0,count:32769),nonce:nonce,now:1)}
var mutated=try JSONSerialization.jsonObject(with:envelope) as! [String:String]
var encrypted=Data(base64Encoded:mutated["data"]!)!;encrypted[0] ^= 1;mutated["data"]=encrypted.base64EncodedString()
rejects{_ = try wire.open(try JSONSerialization.data(withJSONObject:mutated),nonce:nonce,now:1)}
print("Account transfer wire passed: Node/Swift HMAC and AES-GCM interoperability, AAD/tamper, private IPv4, strict code fields, bounded payload and original expiry")
`;
writeFileSync(root+'/WireTests.swift','import Foundation\nimport CryptoKit\n'+source.slice(begin,end).replace(/^private /gm,'')+'\n'+checks);
execFileSync('xcrun',['swiftc','-swift-version','5',root+'/WireTests.swift','-o',root+'/wire-tests'],{stdio:'inherit'});
execFileSync(root+'/wire-tests',[root+'/fixture.json'],{stdio:'inherit'});
