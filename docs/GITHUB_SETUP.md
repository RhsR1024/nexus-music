# 本机GitHub认证与阶段提交

2026-10-15已验证SSH认证为RhsR1024，origin已切换到git@github.com:RhsR1024/nexus-music.git，main已设置跟踪origin/main；工程基线提交6ffa60b已成功push。用户不需要重复执行下面的初次配置步骤。

以下保留初次配置方法。私钥留在用户.ssh，不能放入仓库或Tools公共资料。

## 用户在Mac终端完成

```sh
mkdir -p ~/.ssh
chmod 700 ~/.ssh
ssh-keygen -t ed25519 -C "NexusMusic-Mac" -f ~/.ssh/id_ed25519_github
```

按提示设置密钥口令，口令只在本机输入。该文件名在本次盘点时不存在，不覆盖原RSA密钥。

当前没有.ssh/config，可添加以下配置（已有配置时合并同一Host段）：

```text
Host github.com
  HostName github.com
  User git
  AddKeysToAgent yes
  UseKeychain yes
  IdentityFile ~/.ssh/id_ed25519_github
  IdentitiesOnly yes
```

```sh
chmod 600 ~/.ssh/config
/usr/bin/ssh-add --apple-use-keychain ~/.ssh/id_ed25519_github
pbcopy < ~/.ssh/id_ed25519_github.pub
```

在 https://github.com/settings/ssh/new 添加Authentication key，标题可写NexusMusic Mac，Key粘贴刚复制的**.pub公钥**。

```sh
ssh -T git@github.com
```

应看到向本人GitHub账号问候的成功认证信息；GitHub不提供shell，所以该命令即使认证成功通常返回状态1。初次连接如询问主机身份，可对照GitHub官方SSH指纹页面后确认。

## 认证完成后的仓库配置

```sh
cd /Users/ningli/WorkSpace/NexusMusic
git remote set-url origin git@github.com:RhsR1024/nexus-music.git
git fetch origin
git push -u origin main
```

后续代理负责按阶段完成测试、检查diff与隐私文件排除、本地提交、fetch核对远程更新，再push。普通push发生分叉时先处理差异，不force push。认证受阻时保留本地提交并明确尚未同步，不能宣称远程已更新。

资源脚本/漫途备份/local-config、node_modules、Pods、DerivedData、签名材料与构建日志不提交。用户已授权阶段性提交与push，无需每次重复确认。

官方文档：
- https://docs.github.com/en/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent
- https://docs.github.com/en/authentication/connecting-to-github-with-ssh/adding-a-new-ssh-key-to-your-github-account
- https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints
