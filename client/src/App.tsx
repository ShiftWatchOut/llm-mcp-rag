import { useState, useRef, useEffect } from 'react'
import { 
  Button, 
  Input, 
  Avatar, 
  Typography, 
  Toast, 
  Space, 
  Layout,
  Divider,
  Spin
} from '@douyinfe/semi-ui'
import { IconSend, IconUser, IconBolt } from '@douyinfe/semi-icons'
import './App.css'

const { Text } = Typography
const { Header, Content } = Layout

interface Message {
  id: string
  content: string
  isUser: boolean
  timestamp: string
}

function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const sendMessage = async () => {
    if (!inputValue.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      isUser: true,
      timestamp: new Date().toISOString()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    try {
      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: inputValue })
      })

      if (!response.ok) {
        throw new Error('Network response was not ok')
      }

      const data = await response.json()
      
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.message,
        isUser: false,
        timestamp: data.timestamp
      }

      setMessages(prev => [...prev, botMessage])
    } catch (error) {
      console.error('Error sending message:', error)
      Toast.error({ content: '发送消息失败，请稍后重试' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const renderMessage = (message: Message) => (
    <div
      key={message.id}
      style={{
        display: 'flex',
        justifyContent: message.isUser ? 'flex-end' : 'flex-start',
        marginBottom: '16px'
      }}
    >
      <div
        style={{
          maxWidth: '70%',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px',
          flexDirection: message.isUser ? 'row-reverse' : 'row'
        }}
      >
        <Avatar
          size="small"
          style={{
            backgroundColor: message.isUser ? '#1890ff' : '#52c41a',
            flexShrink: 0,
            marginTop: '4px'
          }}
        >
          {message.isUser ? <IconUser /> : <IconBolt />}
        </Avatar>
        
        <div
          style={{
            backgroundColor: message.isUser ? '#1890ff' : '#f5f5f5',
            color: message.isUser ? '#fff' : '#333',
            padding: '12px 16px',
            borderRadius: '12px',
            maxWidth: '100%',
            wordBreak: 'break-word',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
          }}
        >
          <Text style={{ color: message.isUser ? '#fff' : '#333' }}>
            {message.content}
          </Text>
        </div>
      </div>
    </div>
  )

  return (
    <Layout style={{ height: '100vh', backgroundColor: '#f8f9fa' }}>
      <Header
        style={{
          backgroundColor: '#1890ff',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
        }}
      >
        <Space>
          <Avatar style={{ backgroundColor: '#52c41a' }}>
            <IconBolt />
          </Avatar>
          <div>
            <h1 style={{ margin: 0, color: 'white', fontSize: '18px' }}>
              AI 对话助手
            </h1>
            <Text style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '12px' }}>
              在线
            </Text>
          </div>
        </Space>
      </Header>

      <Content style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }}>
        <div
          style={{
            flex: 1,
            padding: '16px 24px',
            overflowY: 'auto',
            backgroundColor: '#fff'
          }}
        >
          {messages.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#999'
              }}
            >
              <Avatar size="large" style={{ backgroundColor: '#52c41a', marginBottom: '16px' }}>
                <IconBolt />
              </Avatar>
              <Text type="secondary" style={{ fontSize: '16px' }}>
                你好！我是AI助手，有什么可以帮您的吗？
              </Text>
            </div>
          ) : (
            <>
              {messages.map(renderMessage)}
              {isLoading && (
                <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <Avatar size="small" style={{ backgroundColor: '#52c41a', marginTop: '4px' }}>
                      <IconBolt />
                    </Avatar>
                    <div
                      style={{
                        backgroundColor: '#f5f5f5',
                        padding: '12px 16px',
                        borderRadius: '12px',
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
                      }}
                    >
                      <Space>
                        <Spin size="small" />
                        <Text type="secondary">正在思考中...</Text>
                      </Space>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        <Divider style={{ margin: 0 }} />

        <div
          style={{
            padding: '16px 24px',
            backgroundColor: '#fff',
            borderTop: '1px solid #f0f0f0'
          }}
        >
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
            <Input
              value={inputValue}
              onChange={setInputValue}
              onKeyPress={handleKeyPress}
              placeholder="输入您的问题..."
              style={{
                flex: 1,
                borderRadius: '20px',
                padding: '8px 16px'
              }}
              disabled={isLoading}
              showClear
              size="large"
            />
            <Button
              type="primary"
              icon={<IconSend />}
              onClick={sendMessage}
              disabled={isLoading || !inputValue.trim()}
              style={{
                borderRadius: '20px',
                height: '40px',
                minWidth: '80px'
              }}
              size="large"
            >
              发送
            </Button>
          </div>
        </div>
      </Content>
    </Layout>
  )
}

export default App
