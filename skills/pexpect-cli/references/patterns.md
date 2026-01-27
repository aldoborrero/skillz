# pexpect-cli Automation Patterns

Detailed examples and patterns for common automation scenarios.

## Error Handling

### Basic Error Handling

```python
try:
    child = pexpect.spawn('ssh user@host')
    child.expect('password:', timeout=10)
    child.sendline('password')
    child.expect('\$', timeout=30)
    print("Connected successfully")
except pexpect.TIMEOUT:
    print("Connection timeout")
except pexpect.EOF:
    print("Connection closed unexpectedly")
```

### Multiple Expected Patterns

```python
child = pexpect.spawn('ssh user@host')
index = child.expect(['password:', 'Are you sure.*\(yes/no\)'])

if index == 0:
    child.sendline('mypassword')
elif index == 1:
    child.sendline('yes')
    child.expect('password:')
    child.sendline('mypassword')

child.expect('\$')
print("Connected")
```

## Timeout Management

### Setting Timeouts

```python
# Set default timeout for session
child = pexpect.spawn('command', timeout=60)

# Override for specific operations
child.expect('prompt>', timeout=120)  # Long operation

# Wait indefinitely
child.expect('prompt>', timeout=None)
```

### Handling Slow Commands

```python
child.sendline('long_running_command')
child.expect('\$', timeout=300)  # 5 minutes
output = child.before.decode()
```

## Output Processing

### Capturing Output

```python
child.sendline('ls -la')
child.expect('\$')
output = child.before.decode()
print("Output:", output)
```

### Cleaning Output

```python
import re

child.sendline('command')
child.expect('\$')
output = child.before.decode()

# Remove ANSI escape sequences
clean_output = re.sub(r'\x1b\[[0-9;]*m', '', output)

# Remove carriage returns
clean_output = clean_output.replace('\r', '')

print(clean_output)
```

### Streaming Output

```python
child.sendline('tail -f /var/log/syslog')
while True:
    try:
        child.expect('\n', timeout=1)
        print(child.before.decode())
    except pexpect.TIMEOUT:
        continue
    except KeyboardInterrupt:
        break
```

## Complex SSH Workflows

### Multi-Hop SSH

```python
# First hop
child = pexpect.spawn('ssh user1@gateway')
child.expect('password:')
child.sendline('pass1')
child.expect('\$')

# Second hop
child.sendline('ssh user2@internal')
child.expect('password:')
child.sendline('pass2')
child.expect('\$')

# Execute command on final host
child.sendline('hostname')
child.expect('\$')
print(child.before.decode())
```

### SSH with Key Authentication

```python
child = pexpect.spawn('ssh -i ~/.ssh/id_rsa user@host')
index = child.expect(['\$', 'password:', 'passphrase:'])

if index == 1:
    child.sendline('password')
    child.expect('\$')
elif index == 2:
    child.sendline('key_passphrase')
    child.expect('\$')

print("Connected")
```

### SCP File Transfer

```python
child = pexpect.spawn('scp file.txt user@host:/path/')
index = child.expect(['password:', '100%'])

if index == 0:
    child.sendline('mypassword')
    child.expect('100%')

child.expect(pexpect.EOF)
print("Transfer complete")
```

## Database Automation

### PostgreSQL Session

```python
child = pexpect.spawn('psql -U postgres -d mydb')
child.expect('postgres=#')

# Execute query
child.sendline('SELECT * FROM users LIMIT 5;')
child.expect('postgres=#')
print(child.before.decode())

# Transaction
child.sendline('BEGIN;')
child.expect('postgres=#')
child.sendline('UPDATE users SET active = true WHERE id = 1;')
child.expect('postgres=#')
child.sendline('COMMIT;')
child.expect('postgres=#')
print("Transaction complete")
```

### MySQL Session

```python
child = pexpect.spawn('mysql -u root -p')
child.expect('Enter password:')
child.sendline('mypassword')
child.expect('mysql>')

child.sendline('USE mydb;')
child.expect('mysql>')
child.sendline('SHOW TABLES;')
child.expect('mysql>')
print(child.before.decode())
```

### MongoDB Shell

```python
child = pexpect.spawn('mongosh')
child.expect('>')

child.sendline('use mydb')
child.expect('>')
child.sendline('db.users.find().limit(5)')
child.expect('>')
print(child.before.decode())
```

## Interactive Program Automation

### Git with Authentication

```python
child = pexpect.spawn('git clone https://github.com/user/repo.git')
index = child.expect(['Username:', 'Cloning into'])

if index == 0:
    child.sendline('myusername')
    child.expect('Password:')
    child.sendline('mypassword')
    child.expect(pexpect.EOF)

print("Clone complete")
```

### Docker Interactive

```python
# Start container
child = pexpect.spawn('docker run -it ubuntu bash')
child.expect('#')

# Run commands
child.sendline('apt-get update')
child.expect('#', timeout=120)
child.sendline('apt-get install -y vim')
child.expect('#', timeout=120)

# Exit cleanly
child.sendline('exit')
child.expect(pexpect.EOF)
```

### FTP Session

```python
child = pexpect.spawn('ftp ftp.example.com')
child.expect('Name')
child.sendline('username')
child.expect('Password:')
child.sendline('password')
child.expect('ftp>')

child.sendline('ls')
child.expect('ftp>')
print(child.before.decode())

child.sendline('get file.txt')
child.expect('ftp>')
child.sendline('bye')
child.expect(pexpect.EOF)
```

## Advanced Patterns

### State Machine Pattern

```python
states = {
    'connected': False,
    'authenticated': False,
    'ready': False
}

child = pexpect.spawn('ssh user@host')

# Connection state
child.expect('password:')
states['connected'] = True

# Authentication state
child.sendline('password')
child.expect('\$')
states['authenticated'] = True

# Ready state
child.sendline('echo "ready"')
child.expect('ready')
states['ready'] = True

print("State:", states)
```

### Context Manager Pattern

```python
class PexpectSession:
    def __init__(self, command):
        self.command = command
        self.child = None
    
    def __enter__(self):
        self.child = pexpect.spawn(self.command)
        return self.child
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.child:
            self.child.close()

# Usage in pexpect-cli
with PexpectSession('bash') as child:
    child.sendline('echo "test"')
    child.expect('\$')
    print(child.before.decode())
```

### Logging Pattern

```python
import datetime

def log(message):
    timestamp = datetime.datetime.now().isoformat()
    print(f"[{timestamp}] {message}")

child = pexpect.spawn('ssh user@host')
log("Spawned SSH process")

child.expect('password:')
log("Received password prompt")

child.sendline('mypassword')
log("Sent password")

child.expect('\$')
log("Connected successfully")
```

## Performance Optimization

### Batch Commands

```python
# Instead of multiple sendline/expect cycles
commands = [
    'cd /var/log',
    'ls -la',
    'tail -n 20 syslog'
]

child.sendline('; '.join(commands))
child.expect('\$')
print(child.before.decode())
```

### Delaybeforesend

```python
# Adjust typing delay for faster automation
child = pexpect.spawn('command')
child.delaybeforesend = 0.01  # Default is 0.05

child.sendline('fast command')
child.expect('\$')
```

### Buffer Size

```python
# Increase for large outputs
child = pexpect.spawn('command', maxread=65536)
child.sendline('cat large_file.txt')
child.expect('\$')
output = child.before.decode()
```

## Testing Patterns

### Assertion Pattern

```python
child.sendline('whoami')
child.expect('\$')
output = child.before.decode().strip()
assert 'expected_user' in output, f"Unexpected user: {output}"
```

### Validation Pattern

```python
def validate_connection(child):
    child.sendline('echo "ping"')
    child.expect('ping')
    child.expect('\$')
    return True

if validate_connection(child):
    print("Connection validated")
```

## Security Considerations

### Avoid Hardcoded Credentials

```python
import os

password = os.environ.get('SSH_PASSWORD')
if not password:
    raise ValueError("SSH_PASSWORD not set")

child = pexpect.spawn('ssh user@host')
child.expect('password:')
child.sendline(password)
child.expect('\$')
```

### Clean Up Sensitive Data

```python
password = 'sensitive'
child.sendline(password)
del password  # Remove from memory
child.expect('\$')
```

## Common Pitfalls

### Pitfall: Not Escaping Shell Characters

```bash
# Bad - shell interprets special characters
echo "child.sendline('echo $HOME')" | pexpect-cli $session

# Good - use single quotes in heredoc
pexpect-cli $session <<'EOF'
child.sendline('echo $HOME')
EOF
```

### Pitfall: Wrong Expect Pattern

```python
# Bad - too specific, might include prompt variations
child.expect('user@host:~$')

# Good - generic prompt pattern
child.expect('\$')

# Better - flexible pattern
child.expect('[#$]')  # Works for root (#) and user ($)
```

### Pitfall: Forgetting Timeouts

```python
# Bad - hangs forever if prompt doesn't appear
child.expect('\$')

# Good - always set timeout
child.expect('\$', timeout=30)
```

### Pitfall: Not Handling EOF

```python
# Bad - crashes if process exits
child.sendline('exit')
child.expect('\$')

# Good - handle EOF
try:
    child.sendline('exit')
    child.expect(pexpect.EOF, timeout=5)
except pexpect.TIMEOUT:
    print("Process didn't exit cleanly")
```
