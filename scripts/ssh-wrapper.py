#!/usr/bin/env python3
"""
SSH wrapper using paramiko — lets git push over SSH when openssh-client
is not installed in the environment.

Usage: set as GIT_SSH_COMMAND or core.sshCommand
  ssh-wrapper.py [ssh options] user@host command

Git calls this like: ssh-wrapper.py -o SendEnv=GIT_PROTOCOL git@github.com git-receive-pack '7clan/Money-Machine.git'
"""
import sys
import os
import paramiko
import re

def main():
    args = sys.argv[1:]
    # Parse: skip -o options, find user@host, then the remote command
    host = None
    port = 22
    remote_cmd = None
    i = 0
    while i < len(args):
        a = args[i]
        if a == '-p':
            port = int(args[i + 1])
            i += 2
        elif a == '-o':
            # skip -o key=value
            i += 2
        elif a == '-i':
            # identity file — try to use it
            key_file = args[i + 1]
            os.environ['_PARAMIKO_KEY_FILE'] = key_file
            i += 2
        elif a.startswith('-'):
            i += 1
        elif host is None:
            host = a
            i += 1
        else:
            # rest is the remote command
            remote_cmd = ' '.join(args[i:])
            break

    if not host or not remote_cmd:
        sys.stderr.write(f"Usage: {sys.argv[0]} [options] user@host 'command'\n")
        sys.stderr.write(f"  args received: {args}\n")
        sys.exit(1)

    # Parse user@host
    if '@' in host:
        user, hostname = host.split('@', 1)
    else:
        user = 'git'
        hostname = host

    # Connect
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    connect_kwargs = {
        'hostname': hostname,
        'port': port,
        'username': user,
        'timeout': 30,
        'allow_agent': True,
        'look_for_keys': True,
    }

    # Try explicit key file
    key_file = os.environ.get('_PARAMIKO_KEY_FILE')
    if key_file and os.path.exists(key_file):
        for pkey_class in [paramiko.RSAKey, paramiko.Ed25519Key, paramiko.ECDSAKey]:
            try:
                connect_kwargs['pkey'] = pkey_class.from_private_key_file(key_file)
                break
            except Exception:
                continue

    try:
        client.connect(**connect_kwargs)
    except Exception as e:
        sys.stderr.write(f"SSH connection failed: {e}\n")
        sys.stderr.write(f"  hostname={hostname} port={port} user={user}\n")
        sys.stderr.write(f"  No SSH keys found. This environment has no SSH keys configured.\n")
        sys.stderr.write(f"  To push, either:\n")
        sys.stderr.write(f"    1. Provide a PAT: git remote set-url origin https://<PAT>@github.com/7clan/Money-Machine.git\n")
        sys.stderr.write(f"    2. Place an SSH key at ~/.ssh/id_rsa or ~/.ssh/id_ed25519\n")
        sys.stderr.write(f"    3. Push from your own machine\n")
        sys.exit(1)

    # Execute remote command
    stdin, stdout, stderr = client.exec_command(remote_cmd)
    stdin.close()

    # Proxy stdout/stderr
    import select
    channel = stdout.channel
    while not channel.exit_status_ready():
        if channel.recv_ready():
            data = channel.recv(65536)
            if data:
                sys.stdout.buffer.write(data)
                sys.stdout.buffer.flush()
        if channel.recv_stderr_ready():
            data = channel.recv_stderr(65536)
            if data:
                sys.stderr.buffer.write(data)
                sys.stderr.buffer.flush()

    # Drain remaining
    while channel.recv_ready():
        data = channel.recv(65536)
        if data:
            sys.stdout.buffer.write(data)
            sys.stdout.buffer.flush()
    while channel.recv_stderr_ready():
        data = channel.recv_stderr(65536)
        if data:
            sys.stderr.buffer.write(data)
            sys.stderr.buffer.flush()

    exit_code = channel.recv_exit_status()
    client.close()
    sys.exit(exit_code)

if __name__ == '__main__':
    main()
