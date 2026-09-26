extends Node2D

const PLAYER_SCENE := preload("res://scenes/player.tscn")

var ui: Control
var address_input: LineEdit
var status_label: Label
var spawner: MultiplayerSpawner
var world: Node2D

func _ready() -> void:
	world = Node2D.new()
	world.name = "World"
	add_child(world)

	spawner = MultiplayerSpawner.new()
	spawner.name = "PlayerSpawner"
	add_child(spawner)
	spawner.spawn_path = world.get_path()
	spawner.add_spawnable_scene("res://scenes/player.tscn")

	NetworkManager.player_connected.connect(_on_player_connected)
	NetworkManager.player_disconnected.connect(_on_player_disconnected)
	NetworkManager.connected_to_server.connect(_on_connected_to_server)
	NetworkManager.connection_failed.connect(_on_connection_failed)

	if "--server" in OS.get_cmdline_args():
		_start_dedicated_server()
	else:
		_build_ui()

func _start_dedicated_server() -> void:
	var err := NetworkManager.host_server(NetworkManager.DEFAULT_PORT)
	if err == OK:
		print("Dedicated server started on port %d" % NetworkManager.DEFAULT_PORT)
	else:
		push_error("Could not start dedicated server, exiting.")
		get_tree().quit(1)

func _build_ui() -> void:
	ui = Control.new()
	ui.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(ui)

	var box := VBoxContainer.new()
	box.set_anchors_preset(Control.PRESET_CENTER)
	box.custom_minimum_size = Vector2(240, 160)
	ui.add_child(box)

	var title := Label.new()
	title.text = "Custom Ragnarok Online"
	box.add_child(title)

	address_input = LineEdit.new()
	address_input.placeholder_text = "Server IP (e.g. 127.0.0.1)"
	address_input.text = "127.0.0.1"
	box.add_child(address_input)

	var host_button := Button.new()
	host_button.text = "Host Server"
	host_button.pressed.connect(_on_host_pressed)
	box.add_child(host_button)

	var join_button := Button.new()
	join_button.text = "Join Server"
	join_button.pressed.connect(_on_join_pressed)
	box.add_child(join_button)

	status_label = Label.new()
	status_label.text = ""
	box.add_child(status_label)

func _on_host_pressed() -> void:
	var err := NetworkManager.host_server(NetworkManager.DEFAULT_PORT)
	if err == OK:
		status_label.text = "Hosting on port %d" % NetworkManager.DEFAULT_PORT
		ui.hide()
		_spawn_player(1)
	else:
		status_label.text = "Failed to host: %s" % err

func _on_join_pressed() -> void:
	status_label.text = "Connecting..."
	NetworkManager.join_server(address_input.text, NetworkManager.DEFAULT_PORT)

func _on_connected_to_server() -> void:
	status_label.text = "Connected!"
	ui.hide()

func _on_connection_failed() -> void:
	status_label.text = "Connection failed."

func _on_player_connected(id: int) -> void:
	if multiplayer.is_server():
		_spawn_player(id)

func _on_player_disconnected(id: int) -> void:
	var node := world.get_node_or_null(str(id))
	if node:
		node.queue_free()

func _spawn_player(id: int) -> void:
	var player := PLAYER_SCENE.instantiate()
	player.name = str(id)
	world.add_child(player, true)
