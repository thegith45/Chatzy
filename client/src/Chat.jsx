import React, { useContext, useEffect, useRef, useState } from 'react'
import Avatar from './Avatar';
import { UserContext } from './UserContext';
import { uniqBy } from "lodash";
import axios from 'axios';

const Chat = () => {
    const [ws, setWs] = useState(null);
    const [onlinePeople, setOnlinePeople] = useState({});
    const [offlinePeople, setOfflinePeople] = useState({});
    const [selectUserId, setSelectUserId] = useState(null);
    const { username, id, setId, setUsername } = useContext(UserContext);
    const [newMessageText, setNewMessagetext] = useState("");
    const [messages, setMessages] = useState([]);
    const [searchTerm, setSearchTerm] = useState(""); // New state for search
    const divUnderMessages = useRef();

    useEffect(() => {
        connectToWs();
    }, []);

    function connectToWs() {
        const ws = new WebSocket('ws://localhost:4040');
        setWs(ws);
        ws.addEventListener('message', handleMessage);
        ws.addEventListener('close', () => {
            setTimeout(() => {
                console.log('Disconnected. trying to reconnect.');
                connectToWs();
            }, 1000);
        });
    }

    function showOnlinePeople(peopleArray) {
        const people = {};
        peopleArray.forEach(({ userId, username }) => {
            people[userId] = username;
        });
        setOnlinePeople(people);
    }

    function deleteMessage(messageId) {
        if (window.confirm('Are you sure you want to delete this message?')) {
            axios.delete('/messages/' + messageId)
                .then(() => {
                    // Remove message from local state immediately
                    setMessages(prev => prev.filter(msg => msg._id !== messageId));
                })
                .catch(error => {
                    console.error('Delete message error:', error);
                    alert('Failed to delete message');
                });
        }
    }


    function handleMessage(ev) {
        console.log(ev.data);
        const messageData = JSON.parse(ev.data);
        if ('online' in messageData) {
            showOnlinePeople(messageData.online);
        } else if (messageData.type === 'messageDeleted') {
            // Remove deleted message from state
            setMessages(prev => prev.filter(msg => msg._id !== messageData.messageId));
        } else if ('text' in messageData) {
            // Only add message if it's part of current conversation
            if (messageData.sender === selectUserId || messageData.recipient === selectUserId) {
                setMessages(prev => {
                    const newMessages = [...prev, { ...messageData }];
                    console.log('New messages array:', newMessages);
                    return newMessages;
                });
            }
        }
    }

    function logout() {
        axios.post('/logout').then(() => {
            setWs(null);
            setId(null);
            setUsername(null);
        }).catch((error) => {
            console.log('logout error: ', error);
            // Even if logout request fails, clear local state
            if (ws) {
                ws.close();
            }
            setWs(null);
            setId(null);
            setUsername(null);
        });
    }

    function selectContact(userId) {
        setSelectUserId(userId);
    }

    function sendMessage(ev, file = null) {
        if (ev) ev.preventDefault();

        // Store the message text before clearing it
        const messageToSend = newMessageText;

        ws.send(JSON.stringify({
            recipient: selectUserId,
            text: messageToSend,
            file,
        }));

        if (file) {
            axios.get('/messages/' + selectUserId).then(res => {
                setMessages(res.data);
            });
        } else {
            setNewMessagetext(''); // Clear input after sending
            // Add message immediately to state
            setMessages(prev => ([...prev, {
                text: messageToSend,
                sender: id,
                recipient: selectUserId,
                _id: Date.now(),
            }]));
        }
    }

    function sendFile(ev) {
        const reader = new FileReader();
        reader.readAsDataURL(ev.target.files[0]);
        reader.onload = () => {
            sendMessage(null, {
                name: ev.target.files[0].name,
                data: reader.result,
            });
        };
    }

    useEffect(() => {
        const div = divUnderMessages.current;
        if (div) {
            div.scrollIntoView({ behaviour: 'smooth', block: 'end' });

        }
    }, [messages]);

    useEffect(() => {
        if (selectUserId) {
            axios.get('/messages/' + selectUserId).then(res => {
                const { data } = res;
                setMessages(data);
            });
        }
    }, [selectUserId]);

    useEffect(() => {
        axios.get('/people').then(res => {
            const offlineArr = res.data
                .filter(p => p._id !== id)
                .filter(p => !Object.keys(onlinePeople).includes(p._id));
            // console.log(offlinePeople);
            const offlinep = {};
            offlineArr.forEach(p => {
                offlinep[p._id] = p.username;
            });
            setOfflinePeople(offlinep);
            console.log(offlinePeople);

        });
    }, [onlinePeople]);

    const onlinePeopleExclOurUser = { ...onlinePeople };
    delete onlinePeopleExclOurUser[id];

    // Filter people based on search term
    const filteredOnlinePeople = Object.keys(onlinePeopleExclOurUser).filter(userId =>
        onlinePeople[userId].toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredOfflinePeople = Object.keys(offlinePeople).filter(userId =>
        offlinePeople[userId].toLowerCase().includes(searchTerm.toLowerCase())
    );

    const messagesWithoutDupes = uniqBy(messages, '_id');

    return (
        <div className="flex h-screen">
            <div className="bg-purple-100 w-1/3 pt-4 flex flex-col">
                {/* Header */}
                <div className="pl-4 text-purple-600 font-bold flex gap-2 mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                        <path d="M4.913 2.658c2.075-.27 4.19-.408 6.337-.408 2.147 0 4.262.139 6.337.408 1.922.25 3.291 1.861 3.405 3.727a4.403 4.403 0 0 0-1.032-.211 50.89 50.89 0 0 0-8.42 0c-2.358.196-4.04 2.19-4.04 4.434v4.286a4.47 4.47 0 0 0 2.433 3.984L7.28 21.53A.75.75 0 0 1 6 21v-4.03a48.527 48.527 0 0 1-1.087-.128C2.905 16.58 1.5 14.833 1.5 12.862V6.638c0-1.97 1.405-3.718 3.413-3.979Z" />
                        <path d="M15.75 7.5c-1.376 0-2.739.057-4.086.169C10.124 7.797 9 9.103 9 10.609v4.285c0 1.507 1.128 2.814 2.67 2.94 1.243.102 2.5.157 3.768.165l2.782 2.781a.75.75 0 0 0 1.28-.53v-2.39l.33-.026c1.542-.125 2.67-1.433 2.67-2.94v-4.286c0-1.505-1.125-2.811-2.664-2.94A49.392 49.392 0 0 0 15.75 7.5Z" />
                    </svg>
                    ChatX
                </div>

                {/* Search Bar */}
                <div className="px-4 mb-4">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search people..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-3 py-2 pl-10 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="absolute left-3 top-2.5 h-4 w-4 text-gray-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                </div>

                {/* Contacts List */}
                <div className="flex-1 overflow-y-auto">
                    {/* Online People */}
                    {filteredOnlinePeople.map(userId => (
                        <div key={userId}
                            onClick={() => selectContact(userId)}
                            className={"cursor-pointer border-b border-gray-100  flex gap-2 items-center " + (userId === selectUserId ? "bg-purple-50" : "")}>
                            {userId === selectUserId && (
                                <div className="w-1 bg-purple-500 h-10"></div>
                            )}
                            <div className="flex gap-2 pl-4 py-2 items-center">
                                <Avatar username={onlinePeople[userId]} userId={userId} online={true} />
                                <span className="text-gray-800">{onlinePeople[userId]} </span>
                            </div>
                        </div>
                    ))}

                    {/* Offline People */}
                    {filteredOfflinePeople.map(userId => (
                        <div key={userId}
                            onClick={() => selectContact(userId)}
                            className={"cursor-pointer border-b border-gray-100  flex gap-2 items-center " + (userId === selectUserId ? "bg-purple-50" : "")}>
                            {userId === selectUserId && (
                                <div className="w-1 bg-purple-500 h-10"></div>
                            )}
                            <div className="flex gap-2 pl-4 py-2 items-center">
                                <Avatar username={offlinePeople[userId]} userId={userId} online={false} />
                                <span className="text-black">{offlinePeople[userId]} </span>
                            </div>
                        </div>
                    ))}

                    {/* No results message */}
                    {searchTerm && filteredOnlinePeople.length === 0 && filteredOfflinePeople.length === 0 && (
                        <div className="px-4 py-8 text-center text-gray-500">
                            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <p>No people found for "{searchTerm}"</p>
                        </div>
                    )}
                </div>

                {/* User Info and Logout */}
                <div className="mt-auto p-2 text-center flex items-center justify-center border-t border-gray-200">
                    <span className="mr-3 text-sm text-black flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-4">
                            <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
                        </svg>
                        {username}
                    </span>
                    <button
                        onClick={logout}
                        className="text-sm bg-red-400 py-1 px-2 text-black border rounded-sm">
                        logout
                    </button>
                </div>
            </div>

            <div className="flex flex-col bg-slate-800 w-2/3 p-2">
                <div className="ml-2 flex-grow">
                    {!selectUserId && (
                        <div className="flex h-full items-center justify-center">
                            <div className="text-white"> &larr; Select a person</div>
                        </div>
                    )}
                    {!!selectUserId && (
                        <div className="relative h-full">
                            <div className="overflow-y-scroll absolute top-0 left-0 right-0 bottom-2">
                                {messagesWithoutDupes.map(message => (
                                    <div key={message._id} className={(message.sender === id ? 'text-right' : 'text-left')}>
                                        <div className="relative group inline-block">
                                            <div
                                                className={"text-left inline-block rounded-lg py-2 px-2 m-4 "
                                                    + (message.sender === id ? 'bg-purple-600 text-white' : 'bg-white text-gray-900')}>
                                                {message.text}
                                                {message.file && (
                                                    <div className="mt-1">
                                                        <a target="_blank" className="flex items-center gap-1 border-b hover:opacity-80"
                                                            href={axios.defaults.baseURL + '/uploads/' + message.file}>
                                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"
                                                                className="w-4 h-4">
                                                                <path fillRule="evenodd"
                                                                    d="M18.97 3.659a2.25 2.25 0 00-3.182 0l-10.94 10.94a3.75 3.75 0 105.304 5.303l7.693-7.693a.75.75 0 011.06 1.06l-7.693 7.693a5.25 5.25 0 11-7.424-7.424l10.939-10.94a3.75 3.75 0 115.303 5.304L9.097 18.835l-.008.008-.007.007-.002.002-.003.002A2.25 2.25 0 015.91 15.66l7.81-7.81a.75.75 0 011.061 1.06l-7.81 7.81a.75.75 0 001.054 1.068L18.97 6.84a2.25 2.25 0 000-3.182z"
                                                                    clipRule="evenodd" />
                                                            </svg>
                                                            {message.file}
                                                        </a>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Delete button for sender's messages */}
                                            {message.sender === id && (
                                                <button
                                                    onClick={() => deleteMessage(message._id)}
                                                    className="absolute left-[-1rem] top-1/2 -translate-y-1/2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-600"
                                                    title="Delete message"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"
                                                        className="w-3 h-3">
                                                        <path fillRule="evenodd"
                                                            d="M16.5 4.478v.227a48.816 48.816 0 013.878.512.75.75 0 11-.256 1.478l-.209-.035-1.005 13.07a3 3 0 01-2.991 2.77H8.084a3 3 0 01-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 01-.256-1.478A48.567 48.567 0 017.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 013.369 0c1.603.051 2.815 1.387 2.815 2.951zm-6.136-1.452a51.196 51.196 0 013.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 00-6 0v-.113c0-.794.609-1.428 1.364-1.452zm-.355 5.945a.75.75 0 10-1.5.058l.347 9a.75.75 0 101.499-.058l-.346-9zm5.48.058a.75.75 0 10-1.498-.058l-.347 9a.75.75 0 001.5.058l.345-9z"
                                                            clipRule="evenodd" />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                        <div className={`text-xs text-gray-200 mx-2 mb-1 ${message.sender === id ? 'text-right' : 'text-left'}`}>
                                            {message.createdAt ?
                                                new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) :
                                                new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                            }
                                        </div>
                                    </div>
                                ))}

                                <div ref={divUnderMessages}></div>
                            </div>
                        </div>
                    )}
                </div>

                {!!selectUserId && (
                    <form className="ml-2 flex gap-2" onSubmit={sendMessage}>
                        <input type="text"
                            value={newMessageText}
                            onChange={ev => setNewMessagetext(ev.target.value)}
                            className="flex-grow bg-white border p-2 rounded-xl"
                            placeholder="Type your message here" />
                        <label className="bg-purple-200 p-2 text-gray-600 cursor-pointer rounded-xl border border-purple-200 hover:bg-purple-300 transition-colors">
                            <input type="file" className="hidden" onChange={sendFile} />
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                                <path fillRule="evenodd" d="M18.97 3.659a2.25 2.25 0 00-3.182 0l-10.94 10.94a3.75 3.75 0 105.304 5.303l7.693-7.693a.75.75 0 011.06 1.06l-7.693 7.693a5.25 5.25 0 11-7.424-7.424l10.939-10.94a3.75 3.75 0 115.303 5.304L9.097 18.835l-.008.008-.007.007-.002.002-.003.002A2.25 2.25 0 015.91 15.66l7.81-7.81a.75.75 0 011.061 1.06l-7.81 7.81a.75.75 0 001.054 1.068L18.97 6.84a2.25 2.25 0 000-3.182z" clipRule="evenodd" />
                            </svg>
                        </label>
                        <button className="bg-purple-500 p-2 text-white rounded-xl hover:bg-purple-600 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                            </svg>
                        </button>
                    </form>
                )}

            </div>
        </div>
    )
}

export default Chat;
