extends Node

const DEFAULT_PORT := 8910
const MAX_PLAYERS := 32

signal server_started
signal connected_to_server
signal connection_failed
signal player_connected(peer_id: int)
signal player_disconnected(peer_id: int)

var players: Dictionary = {}

func _ready() -> void:
	multiplayer.peer_connected.connect(_on_peer_connected)
	multiplayer.peer_disconnected.connect(_on_peer_disconnected)
	multiplayer.connected_to_server.connect(_on_connected_to_server)
	multiplayer.connection_failed.connect(_on_connection_failed)
	multiplayer.server_disconnected.connect(_on_server_disconnected)

func host_server(port: int = DEFAULT_PORT) -> Error:
	var peer := ENetMultiplayerPeer.new()
	var err := peer.create_server(port, MAX_PLAYERS)
	if err != OK:
		push_error("Failed to host server on port %d: %s" % [port, err])
		return err
	multiplayer.multiplayer_peer = peer
	players[1] = {"id": 1}
	server_started.emit()
	print("Server listening on port %d" % port)
	return OK

func join_server(address: String, port: int = DEFAULT_PORT) -> Error:
	var peer := ENetMultiplayerPeer.new()
	var err := peer.create_client(address, port)
	if err != OK:
		push_error("Failed to connect to %s:%d: %s" % [address, port, err])
		return err
	multiplayer.multiplayer_peer = peer
	return OK

func _on_peer_connected(id: int) -> void:
	players[id] = {"id": id}
	player_connected.emit(id)

func _on_peer_disconnected(id: int) -> void:
	players.erase(id)
	player_disconnected.emit(id)

func _on_connected_to_server() -> void:
	connected_to_server.emit()

func _on_connection_failed() -> void:
	connection_failed.emit()

func _on_server_disconnected() -> void:
	players.clear()
	get_tree().change_scene_to_file("res://scenes/main.tscn")
