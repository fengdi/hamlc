# HAML compiler for Sublime Text 2 in windows
# http://www.cnblogs.com/tangoboy/
# Licensed under the WTFPL

import os, sys, subprocess, functools, sublime, sublime_plugin

package_name = 'hamlc'


def hamlc(fileroot):

	#is_compress = sublime.load_settings('hamlc.sublime-settings').get('')
	
	execmd = '@cscript //nologo "'+sublime.packages_path()+'\\'+package_name+'\\hamlc.wsf"'+' "'+fileroot+'.haml"'+' "'+fileroot+'.html"'
	
	res = subprocess.Popen(execmd,stdout=subprocess.PIPE,shell=True)
	#res.wait()
	remsg = res.stdout.read()

	if remsg=='':
		remsg = ' ** compild:'+fileroot+'.html ** '

	print remsg

	sublime.set_timeout(functools.partial(status,remsg),1200);
	sublime.set_timeout(functools.partial(reloadHtml,fileroot),400);

def status(msg):
	sublime.status_message(msg)

def changeTab(view):
	filepath = view.file_name()
	if(filepath):
		(fileroot, fileext) = os.path.splitext(filepath)
		if(fileext=='.haml'):
			view.settings().set('tab_size', 2)
			view.settings().set('translate_tabs_to_spaces', True)

def reloadHtml(fileroot):
	for win in sublime.windows():
		for view in win.views():
			if(view.file_name()==fileroot+".html"):
				view.run_command("reopen",{"encoding": "utf-8" })
				#print view.file_name()

class EventListener(sublime_plugin.EventListener):
	def on_load(self, view):
		changeTab(view)
	def on_clone(self, view):
		changeTab(view)
	def on_close(self, view):
		changeTab(view)
	def on_pre_save(self, view):
		changeTab(view)
	def on_modified(self, view):
		changeTab(view)
	def on_deactivated(self, view):
		changeTab(view)
	def on_activated(self, view):
		changeTab(view)
		
		#print view.settings().get('tab_size')
		#print view.settings().get('translate_tabs_to_spaces')
	def on_post_save(self, view):
		changeTab(view)
		filepath = view.file_name()
		if(filepath):
			(fileroot, fileext) = os.path.splitext(filepath)
			if(fileext=='.haml'):
				hamlc(fileroot)

#http://www.sublimetext.com/docs/2/api_reference.html


