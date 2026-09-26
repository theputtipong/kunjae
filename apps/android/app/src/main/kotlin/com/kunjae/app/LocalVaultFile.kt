package com.kunjae.app

import android.content.Context
import com.kunjae.client.LocalStore
import java.io.File
import java.io.FileOutputStream
import java.io.IOException

class LocalVaultFile(context: Context) : LocalStore {

    private companion object {
        const val FILE_NAME = "kunjae.local.v1.json"
    }

    private val directory: File = context.applicationContext.noBackupFilesDir
    private val target = File(directory, FILE_NAME)
    private val temp = File(directory, "$FILE_NAME.tmp")

    override fun read(): ByteArray? = if (target.isFile) target.readBytes() else null

    override fun write(bytes: ByteArray) {
        FileOutputStream(temp).use { stream ->
            stream.write(bytes)
            stream.fd.sync()
        }
        if (!temp.renameTo(target)) {
            temp.delete()
            throw IOException("Could not replace the local vault file")
        }
    }

    override fun clear() {
        temp.delete()
        target.delete()
    }
}
